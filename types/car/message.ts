import { CarBasePayload, ControlInputs, SensorConfig } from "@/types/car/shared";
import { EdgeJson, NeuralNetworkJson, NodeJson, PolygonJson } from "@/types/save";
import { ControlType } from "@/lib/car/controls";
import { NeuralNetworkStateJson } from "@/types/car/state";
import { LabelledIntersection } from "@/types/intersection";

/** Payload for initializing car state in worker */
export interface CarInitPayload extends CarBasePayload {
  position: NodeJson;
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
  controlType: ControlType;
  controls: ControlInputs;
  ignoreCarDamage: boolean;
}

/** Payload for updating control inputs in worker */
export interface UpdateControlsPayload extends CarBasePayload {
  controls: ControlInputs;
}

/** Payload for updating traffic and borders for collision detection */
export interface UpdateCollisionDataPayload extends CarBasePayload {
  traffic: PolygonJson[];
  pathBorders: EdgeJson[];
}

/** Payload for updating a single weight in the neural network */
export interface UpdateWeightPayload extends CarBasePayload {
  layerIdx: number;
  fromIdx: number;
  toIdx: number;
  value: number;
}

/** Payload for updating a single bias in the neural network */
export interface UpdateBiasPayload extends CarBasePayload {
  layerIdx: number;
  neuronIdx: number;
  value: number;
}

/** Payload for setting the entire neural network from JSON */
export interface SetBrainPayload extends CarBasePayload {
  brain: NeuralNetworkJson;
}

/** Payload for car state updates sent from worker */
export interface CarStatePayload extends CarBasePayload {
  position: NodeJson;
  angle: number;
  damaged: boolean;
  polygon: PolygonJson | null;
  network: NeuralNetworkStateJson | null;
}

/** Message types sent from main thread to worker */
export const WorkerInboundMessageType = {
  INIT: "worker:init",
  UPDATE_CONTROLS: "worker:update-controls",
  UPDATE_COLLISION_DATA: "worker:update-collision-data",
  UPDATE_WEIGHT: "worker:update-weight",
  UPDATE_BIAS: "worker:update-bias",
  SET_BRAIN: "worker:set-brain",
} as const;

/** Message types sent from worker to main thread */
export const WorkerOutboundMessageType = {
  STATE_UPDATE: "worker:state-update",
  SENSOR_UPDATE: "worker:sensor-update",
} as const;

export interface SensorUpdatePayload {
  id: number;
  readings: (LabelledIntersection | null)[];
  rays: EdgeJson[];
}

export type CarWorkerInboundMessage =
  | { type: typeof WorkerInboundMessageType.INIT; payload: CarInitPayload }
  | {
      type: typeof WorkerInboundMessageType.UPDATE_CONTROLS;
      payload: UpdateControlsPayload;
    }
  | {
      type: typeof WorkerInboundMessageType.UPDATE_COLLISION_DATA;
      payload: UpdateCollisionDataPayload;
    }
  | {
      type: typeof WorkerInboundMessageType.UPDATE_WEIGHT;
      payload: UpdateWeightPayload;
    }
  | {
      type: typeof WorkerInboundMessageType.UPDATE_BIAS;
      payload: UpdateBiasPayload;
    }
  | {
      type: typeof WorkerInboundMessageType.SET_BRAIN;
      payload: SetBrainPayload;
    };

export type CarWorkerOutboundMessage =
  | {
      type: typeof WorkerOutboundMessageType.STATE_UPDATE;
      payload: CarStatePayload;
    }
  | {
      type: typeof WorkerOutboundMessageType.SENSOR_UPDATE;
      payload: SensorUpdatePayload;
    };
