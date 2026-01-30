// ─────────────────────────────────────────────────────────────────────────────
// Worker Message Types
// ─────────────────────────────────────────────────────────────────────────────

/** Message types sent from main thread to worker */
export const WorkerInboundMessageType = {
  INIT: "worker:init",
  UPDATE_CONTROLS: "worker:update-controls",
} as const;

/** Message types sent from worker to main thread */
export const WorkerOutboundMessageType = {
  STATE_UPDATE: "worker:state-update",
} as const;

export type CarWorkerInboundMessage =
  | { type: typeof WorkerInboundMessageType.INIT; payload: CarInitPayload }
  | {
      type: typeof WorkerInboundMessageType.UPDATE_CONTROLS;
      payload: UpdateControlsPayload;
    };

export type CarWorkerOutboundMessage = {
  type: typeof WorkerOutboundMessageType.STATE_UPDATE;
  payload: CarStatePayload;
};

// ─────────────────────────────────────────────────────────────────────────────
// Shared Data Types
// ─────────────────────────────────────────────────────────────────────────────

/** 2D position coordinates */
export interface Position2D {
  x: number;
  y: number;
}

/** Base interface containing car identifier */
export interface CarBasePayload {
  id: number;
}

/** Serializable representation of sensor configuration for worker communication */
export interface SensorConfig {
  rayCount: number;
  rayLength: number;
  raySpreadAngle: number;
  ignoreTraffic: boolean;
}

/** Serializable representation of control inputs for worker communication */
export interface ControlInputs {
  forward: boolean;
  left: boolean;
  right: boolean;
  reverse: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Message Payloads
// ─────────────────────────────────────────────────────────────────────────────

/** Payload for initializing car state in worker */
export interface CarInitPayload extends CarBasePayload {
  position: Position2D;
  breadth: number;
  length: number;
  height: number;
  speed: number;
  acceleration: number;
  maxSpeed: number;
  friction: number;
  angle: number;
  damaged: boolean;
  sensor: SensorConfig;
  controls: ControlInputs;
  ignoreCarDamage: boolean;
}

/** Payload for updating control inputs in worker */
export interface UpdateControlsPayload extends CarBasePayload {
  controls: ControlInputs;
}

/** Payload for car state updates sent from worker */
export interface CarStatePayload extends CarBasePayload {
  position: Position2D;
  angle: number;
  damaged: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Worker State
// ─────────────────────────────────────────────────────────────────────────────

/** Complete car state maintained within the worker thread */
export type WorkerCarState = {
  id: number;
  position: Position2D;
  breadth: number;
  length: number;
  height: number;
  speed: number;
  acceleration: number;
  maxSpeed: number;
  friction: number;
  angle: number;
  damaged: boolean;
  sensor: SensorConfig;
  controls: ControlInputs;
  ignoreCarDamage: boolean;
};
