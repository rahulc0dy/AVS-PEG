/**
 * Message sent from the main thread to a car worker.
 */
export type CarWorkerIncomingMessage =
  | {
      type: "init";
      payload: CarWorkerInitPayload;
    }
  | {
      type: "step";
      payload: CarWorkerStepPayload;
    };

/**
 * Initialization payload delivered when the worker starts.
 */
export interface CarWorkerInitPayload {
  /** Unique identifier for the car. */
  id: number;
  /** Initial kinematic state used to seed the worker. */
  state: CarKinematicsState;
}

/**
 * Simulation step payload containing the latest state and inputs.
 */
export interface CarWorkerStepPayload {
  /** Current kinematic state to advance. */
  state: CarKinematicsState;
  /** Snapshot of inputs applied for this step. */
  controls: CarControlSnapshot;
}

/**
 * Message emitted by the worker back to the main thread.
 */
export type CarWorkerOutgoingMessage =
  | {
      type: "ready";
      payload: CarWorkerReadyPayload;
    }
  | {
      type: "step";
      payload: CarWorkerStepResult;
    };

/**
 * Payload indicating the worker is initialised and ready for work.
 */
export interface CarWorkerReadyPayload {
  /** Identifier echoed from the init payload. */
  id: number;
}

/**
 * Simulation step result returned by the worker.
 */
export interface CarWorkerStepResult extends CarKinematicsStepResult {
  /** Identifier of the car the step corresponds to. */
  id: number;
}

/**
 * Plain data point used by the car worker to avoid importing Three.js or
 * other rendering-only dependencies.
 */
export interface CarFootprintPoint {
  /** X coordinate in world space (maps to Three.js X). */
  x: number;
  /** Y coordinate in world space (maps to Three.js Z). */
  y: number;
}

/**
 * Minimal input snapshot describing the current car controls. This structure
 * intentionally mirrors `Controls` but is serializable for worker messages.
 */
export interface CarControlSnapshot {
  /** True while the forward input is active. */
  forward: boolean;
  /** True while the reverse input is active. */
  reverse: boolean;
  /** True while the left input is active. */
  left: boolean;
  /** True while the right input is active. */
  right: boolean;
}

/**
 * Serializable state used by the car worker to advance kinematics. All values
 * are numbers/booleans so the structure can be transferred between threads.
 */
export interface CarKinematicsState {
  /** Unique identifier for the owning car. */
  id: number;
  /** Current position (y maps to Three.js Z when rendered). */
  position: { x: number; y: number };
  /** Heading angle in radians. */
  angle: number;
  /** Current forward (+) / reverse (-) speed. */
  speed: number;
  /** Per-frame acceleration applied when accelerating or reversing. */
  acceleration: number;
  /** Maximum forward speed. */
  maxSpeed: number;
  /** Friction applied each frame to reduce speed. */
  friction: number;
  /** Vehicle width along X. */
  breadth: number;
  /** Vehicle length along Z. */
  length: number;
}

/**
 * Result returned by a worker step: the updated state plus the car footprint
 * polygon expressed as plain points.
 */
export interface CarKinematicsStepResult {
  /** Updated kinematic state after applying control inputs. */
  state: CarKinematicsState;
  /** Footprint polygon used on the main thread for collision checks. */
  polygonPoints: CarFootprintPoint[];
}
