import { WorkerCarState } from "@/types/car/state";
import {
  CarStatePayload,
  CarWorkerInboundMessage,
  WorkerInboundMessageType,
  WorkerOutboundMessageType,
} from "@/types/car/message";
import { EdgeData, PolygonData, Position2D } from "@/types/car/shared";

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
const createPolygon = (): PolygonData => {
  const { position, breadth, length, angle } = carState;
  const rad = Math.hypot(breadth, length) / 2;
  const alpha = Math.atan2(breadth, length);

  return [
    {
      x: position.x + Math.cos(angle - alpha) * rad,
      y: position.y + Math.sin(angle - alpha) * rad,
    },
    {
      x: position.x + Math.cos(angle + alpha) * rad,
      y: position.y + Math.sin(angle + alpha) * rad,
    },
    {
      x: position.x + Math.cos(Math.PI + angle - alpha) * rad,
      y: position.y + Math.sin(Math.PI + angle - alpha) * rad,
    },
    {
      x: position.x + Math.cos(Math.PI + angle + alpha) * rad,
      y: position.y + Math.sin(Math.PI + angle + alpha) * rad,
    },
  ];
};

/** Check for collisions with traffic and path borders */
const assessDamage = (): boolean => {
  if (!carState.polygon) return false;

  // Check traffic collisions
  if (!carState.ignoreCarDamage) {
    for (const traffic of carState.traffic) {
      if (!traffic.polygon) continue;
      if (doPolygonsIntersect(carState.polygon, traffic.polygon)) {
        return true;
      }
    }
  }

  // Check border collisions
  for (const border of carState.pathBorders) {
    if (doesPolygonIntersectEdge(carState.polygon, border)) {
      return true;
    }
  }

  return false;
};

/** Test whether two polygons intersect (edge-edge intersection test) */
const doPolygonsIntersect = (
  polyA: PolygonData,
  polyB: PolygonData,
): boolean => {
  for (let i = 0; i < polyA.length; i++) {
    const a1 = polyA[i];
    const a2 = polyA[(i + 1) % polyA.length];
    for (let j = 0; j < polyB.length; j++) {
      const b1 = polyB[j];
      const b2 = polyB[(j + 1) % polyB.length];
      if (getIntersection(a1, a2, b1, b2)) {
        return true;
      }
    }
  }
  return false;
};

/** Test whether polygon intersects with an edge */
const doesPolygonIntersectEdge = (
  polygon: PolygonData,
  edge: EdgeData,
): boolean => {
  for (let i = 0; i < polygon.length; i++) {
    const p1 = polygon[i];
    const p2 = polygon[(i + 1) % polygon.length];
    if (getIntersection(p1, p2, edge.n1, edge.n2)) {
      return true;
    }
  }
  return false;
};

/** Linear interpolation */
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/**
 * Compute intersection point between segments AB and CD.
 * Returns intersection coordinates or null if segments don't intersect.
 */
const getIntersection = (
  A: Position2D,
  B: Position2D,
  C: Position2D,
  D: Position2D,
): { x: number; y: number } | null => {
  const tNumerator = (D.x - C.x) * (A.y - C.y) - (D.y - C.y) * (A.x - C.x);
  const uNumerator = (C.y - A.y) * (A.x - B.x) - (C.x - A.x) * (A.y - B.y);
  const denominator = (D.y - C.y) * (B.x - A.x) - (D.x - C.x) * (B.y - A.y);

  const EPSILON = 0.001;
  if (Math.abs(denominator) <= EPSILON) return null;

  const t = tNumerator / denominator;
  const u = uNumerator / denominator;

  if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
    return { x: lerp(A.x, B.x, t), y: lerp(A.y, B.y, t) };
  }
  return null;
};
