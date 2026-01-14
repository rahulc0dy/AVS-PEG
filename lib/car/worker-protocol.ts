import { ControlType } from "@/lib/car/controls";
import type { NodeJson } from "@/types/save";
import type { Intersection } from "@/utils/math";
import type {
  NeuralNetworkJson,
  NeuralNetworkStateJson,
} from "@/lib/ai/network";

export type IntersectionDto = Intersection;

export type RayDto = { start: NodeJson; end: NodeJson };

export type ControlsDto = {
  forward: boolean;
  left: boolean;
  right: boolean;
  reverse: boolean;
};

export type TrafficCarDto = {
  id: string;
  polygon: NodeJson[];
  ignoreCarDamage: boolean;
};

export type RoadRelativeDto = {
  /** Signed lateral offset from the nearest road centerline, normalized to [-1, 1]. */
  lateral: number;
  /** Longitudinal position along the nearest road segment, normalized to [-1, 1]. */
  along: number;
};

/**
 * Destination-relative features for AI navigation.
 */
export type DestinationRelativeDto = {
  /**
   * Angle difference between car heading and direction to destination, normalized to [-1, 1].
   * -1 = destination is directly behind-left, 0 = destination is straight ahead, 1 = destination is directly behind-right
   */
  angleDiff: number;
  /**
   * Normalized distance to destination (0 = at destination, 1 = very far).
   * Uses sigmoid-like normalization for smooth gradient.
   */
  distance: number;
};

/**
 * Path direction features for AI navigation along a path.
 * This helps the car follow curves by providing the direction of the path
 * at the car's current position, rather than just the final destination.
 */
export type PathDirectionDto = {
  /**
   * Angle difference between car heading and the path direction at current position.
   * Normalized to [-1, 1]:
   * -1 = need to turn hard left to follow path
   *  0 = car is aligned with path direction
   *  1 = need to turn hard right to follow path
   */
  angleDiff: number;
};

/**
 * Static wall segments the car's sensors should treat as obstacles.
 * Used for invisible path borders (and can be extended later for road borders).
 */
export type WallEdgeDto = { n1: NodeJson; n2: NodeJson };

/**
 * Path edge with length for progress tracking.
 */
export type PathEdgeDto = {
  n1: NodeJson;
  n2: NodeJson;
  length: number;
};

export type CarInitDto = {
  id: string;
  position: NodeJson;
  breadth: number;
  length: number;
  height: number;
  angle: number;
  maxSpeed: number;
  controlType: ControlType;

  // physics tuning
  acceleration: number;
  friction: number;

  // sensor tuning
  rayCount: number;
  rayLength: number;
  raySpreadAngle: number;

  /** Optional brain JSON to load instead of creating a random brain */
  brainJson?: NeuralNetworkJson;

  /** Mutation amount to apply to the loaded brain (0 = no mutation, 1 = fully random) */
  mutationAmount?: number;

  /** Target destination position for fitness calculation */
  destinationPosition?: NodeJson;

  /** Path edges from source to destination for progress tracking */
  pathEdges?: PathEdgeDto[];

  /** Total length of the path from source to destination */
  totalPathLength?: number;
};

/**
 * Latest environment snapshot sent from the main thread.
 * This is a "last-write-wins" input; the worker simulates using the most recent snapshot.
 */
export type CarSnapshotDto = {
  seq: number;
  traffic: TrafficCarDto[];
  controls?: ControlsDto;
  /** Road-relative features for AI input (computed on main thread). */
  roadRelative?: RoadRelativeDto;
  /** Destination-relative features for AI navigation. */
  destinationRelative?: DestinationRelativeDto;
  /** Path direction at current position for following curves. */
  pathDirection?: PathDirectionDto;
  /** Static wall segments to include in sensor ray tests (e.g., path borders). */
  walls?: WallEdgeDto[];
};

/** Runtime worker configuration (can be changed without re-init). */
export type CarWorkerConfigDto = {
  /** Fixed simulation step size in milliseconds (default ~16.667). */
  fixedDtMs?: number;
  /** Scale wall-clock time (2 = twice as fast). */
  timeScale?: number;
  /** Maximum number of fixed steps to run per loop to avoid spiral-of-death. */
  maxCatchUpSteps?: number;
  /** Upper bound on wall-clock delta used for catch-up (ms). */
  maxWallDeltaMs?: number;
  /** Cap how often state messages are posted back to main thread. */
  publishHz?: number;
};

export type CarStateDto = {
  id: string;
  position: NodeJson;
  angle: number;
  speed: number;
  damaged: boolean;
  polygon: NodeJson[];
  controls: ControlsDto;
  sensor: {
    rays: RayDto[];
    readings: (IntersectionDto | null)[];
  };
  /** Current fitness score (lower distance to destination = higher fitness) */
  fitness: number;
  /** Whether the car has reached the destination */
  reachedDestination: boolean;

  /** Worker-owned simulated time (ms since start). */
  simTimeMs?: number;
  /** Total fixed steps simulated so far. */
  stepIndex?: number;
  /** Snapshot sequence number used for the most recent simulation step. */
  snapshotSeqUsed?: number;
  /** Current neural network state for visualization (only for AI-controlled cars) */
  networkState?: NeuralNetworkStateJson;
};

/** Request from main thread to get the brain data from the worker */
export type GetBrainRequestDto = {
  type: "getBrain";
};

/** Response from worker with the brain data */
export type BrainResponseDto = {
  type: "brain";
  id: string;
  brainJson: NeuralNetworkJson | null;
};

export type CarWorkerInboundMessage =
  | { type: "init"; init: CarInitDto }
  | { type: "start" }
  | { type: "stop" }
  | { type: "configure"; config: CarWorkerConfigDto }
  | { type: "snapshot"; snapshot: CarSnapshotDto }
  | { type: "getBrain" };

export type CarWorkerOutboundMessage =
  | { type: "ready"; id: string }
  | { type: "state"; state: CarStateDto }
  | { type: "brain"; id: string; brainJson: NeuralNetworkJson | null };
