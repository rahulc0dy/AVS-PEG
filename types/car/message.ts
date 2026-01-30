import {
  CarBasePayload,
  ControlInputs,
  EdgeData,
  Position2D,
  SensorConfig,
  TrafficData,
} from "@/types/car/shared";

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

/** Payload for updating traffic and borders for collision detection */
export interface UpdateCollisionDataPayload extends CarBasePayload {
  traffic: TrafficData[];
  pathBorders: EdgeData[];
}

/** Payload for car state updates sent from worker */
export interface CarStatePayload extends CarBasePayload {
  position: Position2D;
  angle: number;
  damaged: boolean;
  polygon: Position2D[] | null;
}

/** Message types sent from main thread to worker */
export const WorkerInboundMessageType = {
  INIT: "worker:init",
  UPDATE_CONTROLS: "worker:update-controls",
  UPDATE_COLLISION_DATA: "worker:update-collision-data",
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
    }
  | {
      type: typeof WorkerInboundMessageType.UPDATE_COLLISION_DATA;
      payload: UpdateCollisionDataPayload;
    };

export type CarWorkerOutboundMessage = {
  type: typeof WorkerOutboundMessageType.STATE_UPDATE;
  payload: CarStatePayload;
};
