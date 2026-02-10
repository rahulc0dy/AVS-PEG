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
