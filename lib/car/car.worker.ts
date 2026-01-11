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
  CarStateDto,
  CarTickDto,
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

/** Sends a message to the main thread. */
function post(msg: CarWorkerOutboundMessage) {
  self.postMessage(msg);
}

/** Returns default destination-relative navigation values. */
function defaultDestinationRelative(): { angleDiff: number; distance: number } {
  return { angleDiff: 0, distance: 1 };
}

/**
 * Calculate progress along the path from source to destination.
 * Returns a value between 0 (at start) and 1 (at destination).
 */
function calculatePathProgress(
  position: NodeJson,
  pathEdges: PathEdgeDto[] | undefined,
  totalPathLength: number | undefined,
): number {
  if (
    !pathEdges ||
    pathEdges.length === 0 ||
    !totalPathLength ||
    totalPathLength <= 0
  ) {
    // Only log this once per worker
    return 0;
  }

  // Find which edge the car is closest to and the projection point
  let bestEdgeIndex = 0;
  let bestT = 0;
  let bestDist = Infinity;

  for (let i = 0; i < pathEdges.length; i++) {
    const edge = pathEdges[i];
    const dx = edge.n2.x - edge.n1.x;
    const dy = edge.n2.y - edge.n1.y;
    const len2 = dx * dx + dy * dy;

    if (len2 <= 0) continue;

    // Project position onto edge (unclamped to detect beyond endpoints)
    const t =
      ((position.x - edge.n1.x) * dx + (position.y - edge.n1.y) * dy) / len2;
    const tClamped = Math.max(0, Math.min(1, t));

    // Calculate distance to the clamped projection point
    const projX = edge.n1.x + tClamped * dx;
    const projY = edge.n1.y + tClamped * dy;
    const dist = Math.hypot(position.x - projX, position.y - projY);

    if (dist < bestDist) {
      bestDist = dist;
      bestEdgeIndex = i;
      bestT = tClamped;
    }
  }

  // Calculate cumulative distance to the start of the best edge
  let cumulativeLength = 0;
  for (let i = 0; i < bestEdgeIndex; i++) {
    cumulativeLength += pathEdges[i].length;
  }

  // Add progress within the current edge
  cumulativeLength += bestT * pathEdges[bestEdgeIndex].length;

  // Normalize to 0-1
  return cumulativeLength / totalPathLength;
}

// =============================================================================
// PHYSICS SIMULATION
// =============================================================================

/**
 * Updates car position and angle based on current controls.
 *
 * Applies acceleration, friction, and steering physics. The car's movement
 * is in the direction it's facing, with steering only effective when moving.
 *
 * Physics model:
 * - Forward/reverse: Adds/subtracts acceleration to speed
 * - Speed is clamped to maxSpeed (forward) or maxSpeed/2 (reverse)
 * - Friction gradually reduces speed towards zero
 * - Steering rotates the car, direction depends on movement direction
 *
 * @param s - The worker state to update in-place
 */
function moveCar(s: WorkerState) {
  const { acceleration, friction, maxSpeed } = s.init;
  const c = s.controls;

  if (c.forward) s.speed += acceleration;
  if (c.reverse) s.speed -= acceleration;

  if (s.speed > maxSpeed) s.speed = maxSpeed;
  if (s.speed < -maxSpeed / 2) s.speed = -maxSpeed / 2;

  if (s.speed > 0) s.speed -= friction;
  if (s.speed < 0) s.speed += friction;

  if (Math.abs(s.speed) < friction) s.speed = 0;

  if (s.speed !== 0) {
    const flip = s.speed > 0 ? 1 : -1;
    if (c.left) s.angle += 0.03 * flip;
    if (c.right) s.angle -= 0.03 * flip;
  }

  s.position = {
    x: s.position.x - Math.sin(s.angle) * s.speed,
    y: s.position.y - Math.cos(s.angle) * s.speed,
  };
}

// =============================================================================
// MAIN SIMULATION LOOP
// =============================================================================

/**
 * Processes a single simulation tick.
 *
 * This is the main update function called every frame. It:
 * 1. Updates controls (from human input or AI decision)
 * 2. Casts sensor rays and gets readings
 * 3. Runs neural network inference for AI cars
 * 4. Applies physics (movement, steering)
 * 5. Checks for collisions
 * 6. Calculates fitness for training
 *
 * @param tick - Tick data containing traffic, walls, controls, etc.
 * @returns Updated car state to send back to main thread
 */
function computeTick(tick: CarTickDto): CarStateDto {
  if (!state) throw new Error("Worker not initialized");

  const init = state.init;
  state.tickCount++;

  // Apply controls
  if (init.controlType === ControlType.HUMAN) {
    state.controls = tick.controls ?? defaultControls();
  } else if (init.controlType === ControlType.NONE) {
    state.controls = defaultControls();
  }

  // Sensors + AI decide (must happen before move to match existing logic)
  const rays = castRays(
    state.position,
    state.angle,
    init.rayCount,
    init.rayLength,
    init.raySpreadAngle,
  );

  const walls = tick.walls ?? [];
  const readings = rays.map((ray) => getReading(ray, tick.traffic, walls));
  const offsets = readings.map((s) => (s == null ? 0 : 1 - s.offset));

  const roadRelative = tick.roadRelative ?? defaultRoadRelative();
  const destRelative = tick.destinationRelative ?? defaultDestinationRelative();

  // Neural network inputs:
  // - Sensor offsets (rayCount inputs): obstacle detection
  // - Road relative lateral: how far from road center
  // - Road relative along: position along road segment
  // - Destination angle diff: which way to turn to face destination
  // - Destination distance: how far to destination
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
    moveCar(state);
  }

  const polygon = createCarPolygon(
    state.position,
    init.breadth,
    init.length,
    state.angle,
  );
  if (!state.damaged) {
    // Collision with other cars
    state.damaged = assessDamage(polygon, tick.traffic);

    // Collision with static walls (e.g., path borders)
    if (!state.damaged) {
      state.damaged = assessWallDamage(polygon, walls);
    }
  }

  // Calculate fitness based on path progress (following the road) rather than straight-line distance
  let fitness = 0;
  if (init.destinationPosition) {
    // If the car is damaged (e.g., hit path borders), it is excluded from fitness.
    if (state.damaged) {
      fitness = 0;
    } else {
      const dx = state.position.x - init.destinationPosition.x;
      const dy = state.position.y - init.destinationPosition.y;
      const distanceToDestination = Math.sqrt(dx * dx + dy * dy);

      // Track best distance achieved (for destination check)
      if (distanceToDestination < state.bestDistanceToDestination) {
        state.bestDistanceToDestination = distanceToDestination;
      }

      // Check if reached destination
      if (distanceToDestination < DESTINATION_THRESHOLD) {
        state.reachedDestination = true;
      }

      // Calculate path progress (0 to 1)
      const pathProgress = calculatePathProgress(
        state.position,
        init.pathEdges,
        init.totalPathLength,
      );

      // Track best path progress achieved
      if (pathProgress > state.bestPathProgress) {
        state.bestPathProgress = pathProgress;
      }

      // FALLBACK: If no path data, use distance-based fitness instead
      let progressFitness: number;
      if (!init.pathEdges || init.pathEdges.length === 0) {
        // Fallback to distance-based fitness (old behavior)
        progressFitness = 1 / (1 + state.bestDistanceToDestination / 100);
      } else {
        // Primary fitness: path progress (0 to 1)
        progressFitness = state.bestPathProgress;
      }

      // Bonus for reaching destination (with time factor - faster = better)
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
  };
}

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

      post({ type: "ready", id: init.id });
      return;
    }

    case "tick": {
      const tick = msg.tick;
      const next = computeTick(tick);
      post({ type: "state", state: next });
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
