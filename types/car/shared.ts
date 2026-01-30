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

/** Serializable edge for worker communication */
export interface EdgeData {
  n1: Position2D;
  n2: Position2D;
}

/** Serializable polygon (array of points) for worker communication */
export type PolygonData = Position2D[];

/** Traffic car data for collision detection */
export interface TrafficData {
  polygon: PolygonData | null;
}
