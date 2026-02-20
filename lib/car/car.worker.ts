import { WorkerCarState } from "@/types/car/state";
import {
  CarStatePayload,
  CarWorkerInboundMessage,
  SensorUpdatePayload,
  SetBrainPayload,
  UpdateBiasPayload,
  UpdateWeightPayload,
  WorkerInboundMessageType,
  WorkerOutboundMessageType,
} from "@/types/car/message";
import {
  doPolygonsIntersect,
  getIntersection,
  Intersection,
  lerp,
} from "@/utils/math";
import { Edge } from "@/lib/primitives/edge";
import { Node } from "@/lib/primitives/node";
import { Polygon } from "@/lib/primitives/polygon";
import { EdgeJson, PolygonJson } from "@/types/save";
import { NeuralNetwork } from "@/lib/ai/network";
import { ControlType } from "@/lib/car/controls";

let carState: WorkerCarState;

onmessage = (event: MessageEvent<CarWorkerInboundMessage>) => {
  const message = event.data;

  switch (message.type) {
    case WorkerInboundMessageType.INIT: {
      carState = {
        ...message.payload,
        polygon: null,
        traffic: [],
        pathBorders: [],
        network: new NeuralNetwork([message.payload.sensor.rayCount, 4, 4, 4]),
        sensorReadings: [],
      };
      startAnimationLoop();
      break;
    }

    case WorkerInboundMessageType.UPDATE_CONTROLS: {
      if (carState.id === message.payload.id) {
        if (carState.controlType == ControlType.HUMAN) {
          carState.controls = message.payload.controls;
        }
      }
      break;
    }

    case WorkerInboundMessageType.UPDATE_COLLISION_DATA: {
      if (carState.id === message.payload.id) {
        carState.traffic = message.payload.traffic;
        carState.pathBorders = message.payload.pathBorders;
      }
      break;
    }

    case WorkerInboundMessageType.UPDATE_WEIGHT: {
      const payload = message.payload as UpdateWeightPayload;
      if (carState.id === payload.id && carState.network) {
        const level = carState.network.levels[payload.layerIdx];
        if (level && level.weights[payload.fromIdx]) {
          level.weights[payload.fromIdx][payload.toIdx] = payload.value;
        }
      }
      break;
    }

    case WorkerInboundMessageType.UPDATE_BIAS: {
      const payload = message.payload as UpdateBiasPayload;
      if (carState.id === payload.id && carState.network) {
        const level = carState.network.levels[payload.layerIdx];
        if (level && level.biases) {
          level.biases[payload.neuronIdx] = payload.value;
        }
      }
      break;
    }

    case WorkerInboundMessageType.SET_BRAIN: {
      const payload = message.payload as SetBrainPayload;
      if (carState.id === payload.id) {
        carState.network = NeuralNetwork.fromJson(payload.brain);
      }
      break;
    }
  }
};

/** Start the animation loop for continuous physics updates. */
const startAnimationLoop = () => {
  requestAnimationFrame(startAnimationLoop);
  updateAndBroadcastState();
};

/** Process physics update and broadcast new state to main thread. */
const updateAndBroadcastState = () => {
  if (carState.damaged) {
    broadcastState();
    return;
  }

  applyPhysicsStep();
  carState.polygon = createPolygon();
  carState.damaged = assessDamage();
  broadcastState();
  computeAndBroadcastSensorReadings();

  if (carState.controlType === ControlType.AI) {
    const outputs = carState.network.decide(
      carState.sensorReadings
        .filter((reading) => reading !== null)
        .map((intersection) => intersection.offset),
    );
    carState.controls.forward = outputs[0] == 1;
    carState.controls.left = outputs[1] == 1;
    carState.controls.right = outputs[2] == 1;
    carState.controls.reverse = outputs[3] == 1;
  }
};

/** Send current state to main thread */
const broadcastState = () => {
  self.postMessage({
    type: WorkerOutboundMessageType.STATE_UPDATE,
    payload: {
      id: carState.id,
      position: carState.position,
      angle: carState.angle,
      damaged: carState.damaged,
      polygon: carState.polygon,
      network: carState.network.getState(),
    } as CarStatePayload,
  });
};

/** Turn rate in radians per frame */
const TURN_RATE = 0.03;

/** Apply a single timestep of vehicle dynamics. */
const applyPhysicsStep = () => {
  applyAcceleration();
  clampSpeed();
  applyFriction();
  applySteering();
  updatePosition();
};

/** Apply forward/reverse acceleration based on control inputs */
const applyAcceleration = () => {
  if (carState.controls.forward) {
    carState.speed += carState.acceleration;
  }
  if (carState.controls.reverse) {
    carState.speed -= carState.acceleration;
  }
};

/** Clamp speed to max forward speed and half max reverse speed */
const clampSpeed = () => {
  const maxReverseSpeed = -carState.maxSpeed / 2;
  if (carState.speed > carState.maxSpeed) {
    carState.speed = carState.maxSpeed;
  }
  if (carState.speed < maxReverseSpeed) {
    carState.speed = maxReverseSpeed;
  }
};

/** Apply friction to gradually reduce speed */
const applyFriction = () => {
  if (carState.speed > 0) {
    carState.speed -= carState.friction;
  }
  if (carState.speed < 0) {
    carState.speed += carState.friction;
  }
  // Stop completely if speed is below friction threshold
  if (Math.abs(carState.speed) < carState.friction) {
    carState.speed = 0;
  }
};

/** Apply steering based on control inputs (inverts when reversing) */
const applySteering = () => {
  if (carState.speed === 0) return;

  const steeringDirection = carState.speed > 0 ? 1 : -1;
  if (carState.controls.left) {
    carState.angle -= TURN_RATE * steeringDirection;
  }
  if (carState.controls.right) {
    carState.angle += TURN_RATE * steeringDirection;
  }
};

/** Update position based on current speed and heading angle */
const updatePosition = () => {
  carState.position.x += Math.cos(carState.angle) * carState.speed;
  carState.position.y += Math.sin(carState.angle) * carState.speed;
};

/** Construct a collision polygon from car's position, dimensions and heading. */
const createPolygon = (): PolygonJson => {
  const { position, breadth, length, angle } = carState;
  const rad = Math.hypot(breadth, length) / 2;
  const alpha = Math.atan2(breadth, length);

  return new Polygon([
    new Node(
      position.x + Math.cos(angle - alpha) * rad,
      position.y + Math.sin(angle - alpha) * rad,
    ),
    new Node(
      position.x + Math.cos(angle + alpha) * rad,
      position.y + Math.sin(angle + alpha) * rad,
    ),
    new Node(
      position.x + Math.cos(Math.PI + angle - alpha) * rad,
      position.y + Math.sin(Math.PI + angle - alpha) * rad,
    ),
    new Node(
      position.x + Math.cos(Math.PI + angle + alpha) * rad,
      position.y + Math.sin(Math.PI + angle + alpha) * rad,
    ),
  ]).toJson();
};

/** Check for collisions with traffic and path borders */
const assessDamage = (): boolean => {
  if (!carState.polygon) return false;

  // Check traffic collisions
  if (!carState.ignoreCarDamage) {
    const carPolygon = Polygon.fromJson(carState.polygon);

    for (const traffic of carState.traffic) {
      if (!traffic) continue;

      const trafficPolygon = Polygon.fromJson(traffic);

      if (doPolygonsIntersect(carPolygon, trafficPolygon)) {
        return true;
      }
    }
  }

  // Check border collisions
  for (const pathBorderJson of carState.pathBorders) {
    const pathBorder = Edge.fromJson(pathBorderJson);

    for (const edgeJson of carState.polygon.edges) {
      const edge = Edge.fromJson(edgeJson);

      if (getIntersection(pathBorder.n1, pathBorder.n2, edge.n1, edge.n2)) {
        return true;
      }
    }
  }

  return false;
};

/**
 * Compute sensor ray intersections and broadcast readings to main thread.
 * This offloads the heavy intersection detection from the main thread.
 */
const computeAndBroadcastSensorReadings = () => {
  if (!carState.sensor || carState.sensor.rayCount === 0) return;

  const rays = castSensorRays();
  carState.sensorReadings = rays.map((ray) => getSensorReading(ray));

  self.postMessage({
    type: WorkerOutboundMessageType.SENSOR_UPDATE,
    payload: {
      id: carState.id,
      readings: carState.sensorReadings,
      rays,
    } as SensorUpdatePayload,
  });
};

/**
 * Build ray segments in world coordinates for the sensor.
 *
 * Rays are evenly distributed across the spread angle and rotated by the
 * car's heading. Each ray is represented as an EdgeJson (start/end positions).
 *
 * @returns Array of ray segments as EdgeJson
 */
const castSensorRays = (): EdgeJson[] => {
  const { rayCount, raySpreadAngle, rayLength } = carState.sensor;
  const rays: EdgeJson[] = [];

  for (let i = 0; i < rayCount; i++) {
    const t = rayCount === 1 ? 0.5 : i / (rayCount - 1);
    const rayAngle =
      carState.angle + lerp(-raySpreadAngle / 2, raySpreadAngle / 2, t);

    const n1 = new Node(carState.position.x, carState.position.y);
    const n2 = new Node(
      carState.position.x + Math.cos(rayAngle) * rayLength,
      carState.position.y + Math.sin(rayAngle) * rayLength,
    );

    const edge = new Edge(n1, n2);
    rays.push(edge.toJson());
  }

  return rays;
};

/**
 * Find the closest intersection point between a ray and any obstacle.
 *
 * Tests against traffic car polygons (if not ignored) and path borders.
 *
 * @param ray - Ray segment to test
 * @returns The nearest Intersection along the ray, or null if none
 */
const getSensorReading = (ray: EdgeJson): Intersection | null => {
  const touches: Intersection[] = [];

  const rayEdge = Edge.fromJson(ray);

  // Test against traffic polygons
  if (!carState.sensor.ignoreTraffic) {
    for (const trafficPolygonJson of carState.traffic) {
      if (!trafficPolygonJson) continue;

      const trafficPolygon = Polygon.fromJson(trafficPolygonJson);

      for (let j = 0; j < trafficPolygon.nodes.length; j++) {
        const polyN1 = trafficPolygon.nodes[j];
        const polyN2 =
          trafficPolygon.nodes[(j + 1) % trafficPolygon.nodes.length];

        const intersection = getIntersection(
          rayEdge.n1,
          rayEdge.n2,
          polyN1,
          polyN2,
        );
        if (intersection) {
          touches.push(intersection);
        }
      }
    }
  }

  // Test against path borders
  for (const pathBorderJson of carState.pathBorders) {
    const pathBorder = Edge.fromJson(pathBorderJson);

    const intersection = getIntersection(
      rayEdge.n1,
      rayEdge.n2,
      pathBorder.n1,
      pathBorder.n2,
    );
    if (intersection) {
      touches.push(intersection);
    }
  }

  if (touches.length === 0) {
    return null;
  }

  // Return the closest intersection (smallest offset)
  const minOffset = Math.min(...touches.map((t) => t.offset));
  return touches.find((t) => t.offset === minOffset) ?? null;
};
