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
};

export type CarTickDto = {
  traffic: TrafficCarDto[];
  controls?: ControlsDto;
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
