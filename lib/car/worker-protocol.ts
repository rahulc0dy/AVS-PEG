import { ControlType } from "@/lib/car/controls";
import type { NodeJson } from "@/types/save";
import type { Intersection } from "@/utils/math";

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
 * Static wall segments the car's sensors should treat as obstacles.
 * Used for invisible path borders (and can be extended later for road borders).
 */
export type WallEdgeDto = { n1: NodeJson; n2: NodeJson };

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
};

export type CarTickDto = {
  traffic: TrafficCarDto[];
  controls?: ControlsDto;
  /** Road-relative features for AI input (computed on main thread). */
  roadRelative?: RoadRelativeDto;

  /** Static wall segments to include in sensor ray tests (e.g., path borders). */
  walls?: WallEdgeDto[];
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
};

export type CarWorkerInboundMessage =
  | { type: "init"; init: CarInitDto }
  | { type: "tick"; tick: CarTickDto };

export type CarWorkerOutboundMessage =
  | { type: "ready"; id: string }
  | { type: "state"; state: CarStateDto };
