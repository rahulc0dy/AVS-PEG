import { ControlInputs, SensorConfig } from "@/types/car/shared";
import { EdgeJson, NodeJson, PolygonJson } from "@/types/save";

/** Complete car state maintained within the worker thread */
export type WorkerCarState = {
  id: number;
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
  controls: ControlInputs;
  ignoreCarDamage: boolean;
  /** Cached polygon for collision detection */
  polygon: PolygonJson | null;
  /** Traffic data for collision detection */
  traffic: PolygonJson[];
  /** Path borders for collision detection */
  pathBorders: EdgeJson[];
};
