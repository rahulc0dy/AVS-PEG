/// <reference lib="webworker" />

/**
 * Web Worker for Car Simulation and AI Decision Making
 *
 * This worker handles all physics and AI computations for a single car,
 * running in isolation from the main thread to enable parallel processing.
 *
 * Responsibilities:
 * - Physics simulation (movement, acceleration, steering)
 * - Sensor ray casting and collision detection
 * - Neural network inference for AI-controlled cars
 * - Fitness calculation for evolutionary training
 *
 * Communication Protocol:
 * - Receives: init, tick, getBrain messages
 * - Sends: ready, state, brain messages
 */

import { NeuralNetwork } from "@/lib/ai/network";
import { ControlType } from "@/lib/car/controls";
import { getIntersection, lerp } from "@/utils/math";
import { Node } from "@/lib/primitives/node";
import type {
  CarInitDto,
  CarSnapshotDto,
  CarStateDto,
  CarWorkerConfigDto,
  CarWorkerInboundMessage,
  CarWorkerOutboundMessage,
  ControlsDto,
  PathEdgeDto,
  RayDto,
  TrafficCarDto,
  WallEdgeDto,
} from "@/lib/car/worker-protocol";
import type { NodeJson } from "@/types/save";

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Converts a plain NodeJson object to a Node instance.
 * Required for geometric calculations that expect Node objects.
 */
function toNode(p: NodeJson): Node {
  return new Node(p.x, p.y);
}

/**
 * Creates a rectangular polygon representing the car's collision box.
 *
 * The polygon is centered at the car's position and rotated by its angle.
 * Uses polar coordinates for each corner based on the rectangle's diagonal.
 *
 * @param position - Center position of the car
 * @param breadth - Width of the car (perpendicular to direction)
 * @param length - Length of the car (along direction)
 * @param angle - Car's rotation angle in radians
 * @returns Array of 4 corner points forming the car polygon
 */
function createCarPolygon(
  position: NodeJson,
  breadth: number,
  length: number,
  angle: number,
): NodeJson[] {
  const rad = Math.hypot(breadth, length) / 2;
  const alpha = Math.atan2(breadth, length);

  return [
    {
      x: position.x - Math.sin(angle - alpha) * rad,
      y: position.y - Math.cos(angle - alpha) * rad,
    },
    {
      x: position.x - Math.sin(angle + alpha) * rad,
      y: position.y - Math.cos(angle + alpha) * rad,
    },
    {
      x: position.x - Math.sin(Math.PI + angle - alpha) * rad,
      y: position.y - Math.cos(Math.PI + angle - alpha) * rad,
    },
    {
      x: position.x - Math.sin(Math.PI + angle + alpha) * rad,
      y: position.y - Math.cos(Math.PI + angle + alpha) * rad,
    },
  ];
}

/** Returns default (inactive) control state. */
function defaultControls(): ControlsDto {
  return { forward: false, left: false, right: false, reverse: false };
}

/** Returns default road-relative position (centered on road). */
function defaultRoadRelative(): { lateral: number; along: number } {
  return { lateral: 0, along: 0 };
}

/** Returns default destination-relative features. */
function defaultDestinationRelative(): { angleDiff: number; distance: number } {
  return { angleDiff: 0, distance: 1 };
}

/**
 * Returns the closest point on segment AB to point P.
 */
function closestPointOnSegment(
  p: NodeJson,
  a: NodeJson,
  b: NodeJson,
): { x: number; y: number; t: number } {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const apx = p.x - a.x;
  const apy = p.y - a.y;
  const len2 = abx * abx + aby * aby;
  if (len2 <= 0) return { x: a.x, y: a.y, t: 0 };
  const t = (apx * abx + apy * aby) / len2;
  const tClamped = Math.max(0, Math.min(1, t));
  return { x: a.x + abx * tClamped, y: a.y + aby * tClamped, t: tClamped };
}

/**
 * Calculate normalized progress (0..1) along a polyline path composed of edges.
 * We find the closest point on any edge and convert that to a cumulative distance.
 */
function calculatePathProgress(
  position: NodeJson,
  pathEdges?: PathEdgeDto[],
  totalPathLength?: number,
): number {
  if (!pathEdges || pathEdges.length === 0) return 0;

  const total = totalPathLength ?? pathEdges.reduce((s, e) => s + e.length, 0);
  if (total <= 0) return 0;

  let bestDist = Infinity;
  let bestProgress = 0;

  let cumulativeBefore = 0;
  for (const edge of pathEdges) {
    const cp = closestPointOnSegment(position, edge.n1, edge.n2);
    const dx = position.x - cp.x;
    const dy = position.y - cp.y;
    const d = Math.sqrt(dx * dx + dy * dy);

    if (d < bestDist) {
      bestDist = d;
      bestProgress = (cumulativeBefore + cp.t * edge.length) / total;
    }

    cumulativeBefore += edge.length;
  }

  // Clamp to [0, 1]
  return Math.max(0, Math.min(1, bestProgress));
}

// =============================================================================
// SENSOR SYSTEM
// =============================================================================

/**
 * Casts sensor rays from the car's position.
 *
 * Rays are spread evenly across the specified angle, centered on the car's
 * forward direction. Used for obstacle detection by the neural network.
 *
 * @param carPos - Current car position
 * @param carAngle - Car's facing direction in radians
 * @param rayCount - Number of rays to cast
 * @param rayLength - Maximum length of each ray
 * @param raySpreadAngle - Total angle spread for all rays in radians
 * @returns Array of ray start/end points
 */
function castRays(
  carPos: NodeJson,
  carAngle: number,
  rayCount: number,
  rayLength: number,
  raySpreadAngle: number,
): RayDto[] {
  const rays: RayDto[] = [];
  for (let i = 0; i < rayCount; i++) {
    const rayAngle =
      lerp(
        raySpreadAngle / 2,
        -raySpreadAngle / 2,
        rayCount === 1 ? 0.5 : i / (rayCount - 1),
      ) - carAngle;

    const start = { x: carPos.x, y: carPos.y };
    const end = {
      x: carPos.x + Math.sin(rayAngle) * rayLength,
      y: carPos.y - Math.cos(rayAngle) * rayLength,
    };

    rays.push({ start, end });
  }
  return rays;
}

/**
 * Gets the nearest intersection point for a ray against traffic and walls.
 *
 * Tests the ray against all traffic car polygons and static wall segments,
 * returning the closest intersection if any exists.
 *
 * @param ray - The ray to test (start and end points)
 * @param traffic - Array of traffic cars with their polygons
 * @param walls - Array of static wall edges
 * @returns Intersection point with offset (0-1 along ray), or null if no hit
 */
function getReading(
  ray: RayDto,
  traffic: TrafficCarDto[],
  walls: WallEdgeDto[] = [],
): { x: number; y: number; offset: number } | null {
  const touches: { x: number; y: number; offset: number }[] = [];

  for (const car of traffic) {
    const poly = car.polygon;
    if (!poly || poly.length < 2) continue;

    for (let j = 0; j < poly.length; j++) {
      const value = getIntersection(
        toNode(ray.start),
        toNode(ray.end),
        toNode(poly[j]),
        toNode(poly[(j + 1) % poly.length]),
      );
      if (value) touches.push(value);
    }
  }

  // Also test static wall segments (e.g., invisible path borders)
  for (const wall of walls) {
    const value = getIntersection(
      toNode(ray.start),
      toNode(ray.end),
      toNode(wall.n1),
      toNode(wall.n2),
    );
    if (value) touches.push(value);
  }

  if (touches.length === 0) return null;

  return touches.reduce((best, t) => (t.offset < best.offset ? t : best));
}

// =============================================================================
// COLLISION DETECTION
// =============================================================================

/**
 * Checks if the car polygon intersects with any traffic car.
 *
 * Uses edge-to-edge intersection tests between the car's polygon and
 * all traffic car polygons. Respects the ignoreCarDamage flag on traffic.
 *
 * @param selfPoly - The car's collision polygon
 * @param traffic - Array of traffic cars to test against
 * @returns True if any collision detected
 */
function assessDamage(selfPoly: NodeJson[], traffic: TrafficCarDto[]): boolean {
  for (const car of traffic) {
    const other = car.polygon;
    if (!other || other.length < 3) continue;
    if (!car.ignoreCarDamage) {
      for (let i = 0; i < selfPoly.length; i++) {
        const a1 = selfPoly[i];
        const a2 = selfPoly[(i + 1) % selfPoly.length];
        for (let j = 0; j < other.length; j++) {
          const b1 = other[j];
          const b2 = other[(j + 1) % other.length];
          if (getIntersection(toNode(a1), toNode(a2), toNode(b1), toNode(b2))) {
            return true;
          }
        }
      }
    }
  }
  return false;
}

/**
 * Checks if the car polygon intersects with any static wall segment (path borders).
 */
function assessWallDamage(
  selfPoly: NodeJson[],
  walls: WallEdgeDto[] = [],
): boolean {
  if (!walls || walls.length === 0) return false;

  for (let i = 0; i < selfPoly.length; i++) {
    const a1 = selfPoly[i];
    const a2 = selfPoly[(i + 1) % selfPoly.length];

    for (const wall of walls) {
      if (
        getIntersection(
          toNode(a1),
          toNode(a2),
          toNode(wall.n1),
          toNode(wall.n2),
        )
      ) {
        return true;
      }
    }
  }

  return false;
}

// =============================================================================
// WORKER STATE
// =============================================================================

type WorkerState = {
  init: CarInitDto;
  position: NodeJson;
  angle: number;
  speed: number;
  damaged: boolean;
  controls: ControlsDto;
  brain: NeuralNetwork | null;
  bestDistanceToDestination: number;
  reachedDestination: boolean;
  tickCount: number;
  /** Best progress along path achieved (0 to 1) */
  bestPathProgress: number;
};

/** Distance threshold (in world units) to consider destination reached. */
const DESTINATION_THRESHOLD = 30;

/** Current worker state, initialized on 'init' message. */
let state: WorkerState | null = null;

// =============================================================================
// RUNTIME LOOP (worker owns time)
// =============================================================================

type Runtime = {
  running: boolean;
  lastWallTimeMs: number;
  accumulatorMs: number;
  simTimeMs: number;
  stepIndex: number;

  fixedDtMs: number;
  timeScale: number;
  maxCatchUpSteps: number;
  maxWallDeltaMs: number;
  publishHz: number;

  lastPublishWallMs: number;

  latestSnapshot: CarSnapshotDto | null;
  latestSnapshotSeq: number;
};

const runtime: Runtime = {
  running: false,
  lastWallTimeMs: 0,
  accumulatorMs: 0,
  simTimeMs: 0,
  stepIndex: 0,

  fixedDtMs: 1000 / 60,
  timeScale: 1,
  maxCatchUpSteps: 8,
  maxWallDeltaMs: 250,
  publishHz: 30,

  lastPublishWallMs: 0,

  latestSnapshot: null,
  latestSnapshotSeq: -1,
};

function applyConfig(config: CarWorkerConfigDto) {
  if (config.fixedDtMs !== undefined && config.fixedDtMs > 0) {
    runtime.fixedDtMs = config.fixedDtMs;
  }
  if (config.timeScale !== undefined && config.timeScale > 0) {
    runtime.timeScale = config.timeScale;
  }
  if (config.maxCatchUpSteps !== undefined && config.maxCatchUpSteps > 0) {
    runtime.maxCatchUpSteps = config.maxCatchUpSteps;
  }
  if (config.maxWallDeltaMs !== undefined && config.maxWallDeltaMs > 0) {
    runtime.maxWallDeltaMs = config.maxWallDeltaMs;
  }
  if (config.publishHz !== undefined && config.publishHz >= 0) {
    runtime.publishHz = config.publishHz;
  }
}

/** Sends a message to the main thread. */
function post(msg: CarWorkerOutboundMessage) {
  self.postMessage(msg);
}

function defaultSnapshot(): CarSnapshotDto {
  return {
    seq: -1,
    traffic: [],
    controls: undefined,
    roadRelative: { lateral: 0, along: 0 },
    destinationRelative: { angleDiff: 0, distance: 1 },
    walls: [],
  };
}

// =============================================================================
// PHYSICS SIMULATION
// =============================================================================

/**
 * Updates car position and angle based on current controls.
 *
 * NOTE: This version is dt-aware. All per-second rates are derived from the
 * original per-tick constants assuming a 60Hz loop.
 */
function moveCar(s: WorkerState, dtSeconds: number) {
  const { acceleration, friction, maxSpeed } = s.init;
  const c = s.controls;

  // Original code treated acceleration/friction as "per-tick". Convert to per-second using 60Hz.
  const accelPerSec = acceleration * 60;
  const frictionPerSec = friction * 60;

  if (c.forward) s.speed += accelPerSec * dtSeconds;
  if (c.reverse) s.speed -= accelPerSec * dtSeconds;

  if (s.speed > maxSpeed) s.speed = maxSpeed;
  if (s.speed < -maxSpeed / 2) s.speed = -maxSpeed / 2;

  if (s.speed > 0) s.speed -= frictionPerSec * dtSeconds;
  if (s.speed < 0) s.speed += frictionPerSec * dtSeconds;

  if (Math.abs(s.speed) < frictionPerSec * dtSeconds) s.speed = 0;

  if (s.speed !== 0) {
    const flip = s.speed > 0 ? 1 : -1;
    // Original steering: 0.03 rad/tick at 60Hz.
    const steerRadPerSec = 0.03 * 60;
    if (c.left) s.angle += steerRadPerSec * dtSeconds * flip;
    if (c.right) s.angle -= steerRadPerSec * dtSeconds * flip;
  }

  s.position = {
    x: s.position.x - Math.sin(s.angle) * s.speed,
    y: s.position.y - Math.cos(s.angle) * s.speed,
  };
}

// =============================================================================
// MAIN SIMULATION STEP
// =============================================================================

function computeStep(snapshot: CarSnapshotDto, dtSeconds: number): CarStateDto {
  if (!state) throw new Error("Worker not initialized");

  const init = state.init;
  state.tickCount++;

  // Apply controls
  if (init.controlType === ControlType.HUMAN) {
    state.controls = snapshot.controls ?? defaultControls();
  } else if (init.controlType === ControlType.NONE) {
    state.controls = defaultControls();
  }

  // Sensors + AI decide
  const rays = castRays(
    state.position,
    state.angle,
    init.rayCount,
    init.rayLength,
    init.raySpreadAngle,
  );

  const walls = snapshot.walls ?? [];
  const readings = rays.map((ray) => getReading(ray, snapshot.traffic, walls));
  const offsets = readings.map((s) => (s == null ? 0 : 1 - s.offset));

  const roadRelative = snapshot.roadRelative ?? defaultRoadRelative();
  const destRelative =
    snapshot.destinationRelative ?? defaultDestinationRelative();

  const nnInputs = offsets.concat([
    roadRelative.lateral,
    roadRelative.along,
    destRelative.angleDiff,
    destRelative.distance,
  ]);

  if (init.controlType === ControlType.AI && state.brain) {
    const outputs = state.brain.decide(nnInputs);
    state.controls = {
      forward: outputs[0] === 1,
      left: outputs[1] === 1,
      right: outputs[2] === 1,
      reverse: outputs[3] === 1,
    };
  }

  // Movement + collisions
  if (!state.damaged) {
    moveCar(state, dtSeconds);
  }

  const polygon = createCarPolygon(
    state.position,
    init.breadth,
    init.length,
    state.angle,
  );
  if (!state.damaged) {
    state.damaged = assessDamage(polygon, snapshot.traffic);
    if (!state.damaged) {
      state.damaged = assessWallDamage(polygon, walls);
    }
  }

  // Fitness
  let fitness = 0;
  if (init.destinationPosition) {
    if (state.damaged) {
      fitness = 0;
    } else {
      const dx = state.position.x - init.destinationPosition.x;
      const dy = state.position.y - init.destinationPosition.y;
      const distanceToDestination = Math.sqrt(dx * dx + dy * dy);

      if (distanceToDestination < state.bestDistanceToDestination) {
        state.bestDistanceToDestination = distanceToDestination;
      }

      if (distanceToDestination < DESTINATION_THRESHOLD) {
        state.reachedDestination = true;
      }

      const pathProgress = calculatePathProgress(
        state.position,
        init.pathEdges,
        init.totalPathLength,
      );
      if (pathProgress > state.bestPathProgress) {
        state.bestPathProgress = pathProgress;
      }

      let progressFitness: number;
      if (!init.pathEdges || init.pathEdges.length === 0) {
        progressFitness = 1 / (1 + state.bestDistanceToDestination / 100);
      } else {
        progressFitness = state.bestPathProgress;
      }

      const timeBonus = state.reachedDestination
        ? 1.0 + 0.5 * Math.max(0, 1 - state.tickCount / 3000)
        : 0;

      fitness = progressFitness + timeBonus;
    }
  }

  return {
    id: init.id,
    position: { x: state.position.x, y: state.position.y },
    angle: state.angle,
    speed: state.speed,
    damaged: state.damaged,
    polygon,
    controls: { ...state.controls },
    sensor: {
      rays,
      readings,
    },
    fitness,
    reachedDestination: state.reachedDestination,
    simTimeMs: runtime.simTimeMs,
    stepIndex: runtime.stepIndex,
    snapshotSeqUsed: snapshot.seq,
  };
}

function shouldPublishState(nowMs: number): boolean {
  if (runtime.publishHz === 0) return false;
  const intervalMs = runtime.publishHz > 0 ? 1000 / runtime.publishHz : 0;
  if (intervalMs === 0) return true;
  return nowMs - runtime.lastPublishWallMs >= intervalMs;
}

function loopOnce() {
  if (!runtime.running || !state) return;

  const nowMs = performance.now();
  if (runtime.lastWallTimeMs === 0) {
    runtime.lastWallTimeMs = nowMs;
    runtime.lastPublishWallMs = nowMs;
  }

  let wallDeltaMs = nowMs - runtime.lastWallTimeMs;
  runtime.lastWallTimeMs = nowMs;

  if (!Number.isFinite(wallDeltaMs) || wallDeltaMs < 0) wallDeltaMs = 0;
  if (wallDeltaMs > runtime.maxWallDeltaMs)
    wallDeltaMs = runtime.maxWallDeltaMs;

  runtime.accumulatorMs += wallDeltaMs * runtime.timeScale;

  const snapshot = runtime.latestSnapshot ?? defaultSnapshot();
  const dtSeconds = runtime.fixedDtMs / 1000;

  let steps = 0;
  let lastState: CarStateDto | null = null;
  while (
    runtime.accumulatorMs >= runtime.fixedDtMs &&
    steps < runtime.maxCatchUpSteps
  ) {
    const s = computeStep(snapshot, dtSeconds);
    lastState = s;
    runtime.accumulatorMs -= runtime.fixedDtMs;
    runtime.simTimeMs += runtime.fixedDtMs;
    runtime.stepIndex++;
    steps++;
  }

  if (lastState && shouldPublishState(nowMs)) {
    runtime.lastPublishWallMs = nowMs;
    post({ type: "state", state: lastState });
  }

  // Keep the loop going.
  setTimeout(loopOnce, 0);
}

function startLoop() {
  if (runtime.running) return;
  runtime.running = true;
  runtime.lastWallTimeMs = 0;
  runtime.accumulatorMs = 0;
  runtime.lastPublishWallMs = 0;
  setTimeout(loopOnce, 0);
}

function stopLoop() {
  runtime.running = false;
}

// =============================================================================
// EXISTING FUNCTIONS (unchanged below this point, except message handling)
// =============================================================================

self.onmessage = (event: MessageEvent<CarWorkerInboundMessage>) => {
  const msg = event.data;

  switch (msg.type) {
    case "init": {
      const init: CarInitDto = msg.init;

      // Create brain: either from provided JSON (with optional mutation) or random
      let brain: NeuralNetwork | null = null;
      if (init.controlType === ControlType.AI) {
        if (init.brainJson) {
          brain = NeuralNetwork.fromJson(init.brainJson);
          if (init.mutationAmount !== undefined && init.mutationAmount > 0) {
            NeuralNetwork.mutate(brain, init.mutationAmount);
          }
        } else {
          // Architecture: rayCount sensors + 4 nav features -> 8 hidden -> 4 outputs
          const inputCount = init.rayCount + 4;
          brain = new NeuralNetwork([inputCount, 8, 4]);
        }
      }

      // Calculate initial distance to destination
      let initialDistance = Infinity;
      if (init.destinationPosition) {
        const dx = init.position.x - init.destinationPosition.x;
        const dy = init.position.y - init.destinationPosition.y;
        initialDistance = Math.sqrt(dx * dx + dy * dy);
      }

      state = {
        init,
        position: { ...init.position },
        angle: init.angle,
        speed: 0,
        damaged: false,
        controls:
          init.controlType === ControlType.AI
            ? { forward: true, left: false, right: false, reverse: false }
            : defaultControls(),
        brain,
        bestDistanceToDestination: initialDistance,
        reachedDestination: false,
        tickCount: 0,
        bestPathProgress: 0,
      };

      // Reset runtime
      runtime.simTimeMs = 0;
      runtime.stepIndex = 0;
      runtime.accumulatorMs = 0;
      runtime.lastWallTimeMs = 0;
      runtime.latestSnapshot = null;
      runtime.latestSnapshotSeq = -1;

      post({ type: "ready", id: init.id });
      return;
    }

    case "configure": {
      applyConfig(msg.config);
      return;
    }

    case "snapshot": {
      const snap = msg.snapshot;
      if (snap.seq >= runtime.latestSnapshotSeq) {
        runtime.latestSnapshot = snap;
        runtime.latestSnapshotSeq = snap.seq;
      }
      return;
    }

    case "start": {
      startLoop();
      return;
    }

    case "stop": {
      stopLoop();
      return;
    }

    case "getBrain": {
      post({
        type: "brain",
        id: state?.init.id ?? "unknown",
        brainJson: state?.brain ? state.brain.toJson() : null,
      });
      return;
    }
  }
};
