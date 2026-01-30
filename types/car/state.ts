import {
  ControlInputs,
  EdgeData,
  Position2D,
  SensorConfig,
  TrafficData,
} from "@/types/car/shared";

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
  /** Cached polygon for collision detection */
  polygon: Position2D[] | null;
  /** Traffic data for collision detection */
  traffic: TrafficData[];
  /** Path borders for collision detection */
  pathBorders: EdgeData[];
};
