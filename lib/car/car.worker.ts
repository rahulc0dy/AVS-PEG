import { WorkerCarState } from "@/types/car/state";
import {
  CarStatePayload,
  CarWorkerInboundMessage,
  WorkerInboundMessageType,
  WorkerOutboundMessageType,
} from "@/types/car/message";
import { doPolygonsIntersect, getIntersection } from "@/utils/math";
import { Node } from "@/lib/primitives/node";
import { Polygon } from "@/lib/primitives/polygon";

let carState: WorkerCarState;

onmessage = (event: MessageEvent<CarWorkerInboundMessage>) => {
  const message = event.data;

  switch (message.type) {
    case WorkerInboundMessageType.INIT:
      carState = {
        ...message.payload,
        polygon: null,
        traffic: [],
        pathBorders: [],
      };
      startAnimationLoop();
      break;

    case WorkerInboundMessageType.UPDATE_CONTROLS:
      if (carState.id === message.payload.id) {
        carState.controls = message.payload.controls;
      }
      break;

    case WorkerInboundMessageType.UPDATE_COLLISION_DATA:
      if (carState.id === message.payload.id) {
        carState.traffic = message.payload.traffic;
        carState.pathBorders = message.payload.pathBorders;
      }
      break;
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
const createPolygon = (): Polygon => {
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
  ]);
};

/** Check for collisions with traffic and path borders */
const assessDamage = (): boolean => {
  if (!carState.polygon) return false;

  // Check traffic collisions
  if (!carState.ignoreCarDamage) {
    const carPolygon = new Polygon([]);
    carPolygon.fromJson(carState.polygon);

    for (const traffic of carState.traffic) {
      if (!traffic) continue;

      const trafficPolygon = new Polygon([]);
      trafficPolygon.fromJson(trafficPolygon);

      if (doPolygonsIntersect(carPolygon, trafficPolygon)) {
        return true;
      }
    }
  }

  // Check border collisions
  for (const pathBorder of carState.pathBorders) {
    const pathBorderN1 = new Node(0, 0);
    pathBorderN1.fromJson(pathBorder.n1);

    const pathBorderN2 = new Node(0, 0);
    pathBorderN2.fromJson(pathBorder.n2);

    for (const edge of carState.polygon.edges) {
      const edgeN1 = new Node(0, 0);
      edgeN1.fromJson(edge.n1);

      const edgeN2 = new Node(0, 0);
      edgeN2.fromJson(edge.n2);
      if (getIntersection(pathBorderN1, pathBorderN2, edgeN1, edgeN2)) {
        return true;
      }
    }
  }

  return false;
};
