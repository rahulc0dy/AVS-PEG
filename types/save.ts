import { LightState } from "@/lib/markings/traffic-light";
import { MarkingType } from "./marking";

export interface WorldJson {
  graph: GraphJson;
  roadWidth: number;
  roadRoundness: number;
  trafficLights: TrafficLightJson[];
  roadBorders: EdgeJson[];
  roads: EnvelopeJson[];
}

export interface GraphJson {
  nodes: NodeJson[];
  edges: EdgeJson[];
}

export interface NodeJson {
  x: number;
  y: number;
}

export interface EdgeJson {
  n1: NodeJson;
  n2: NodeJson;
  isDirected: boolean;
}

export interface TrafficLightJson extends MarkingJson {
  lightState: LightState;
}

export interface EnvelopeJson {
  skeleton: EdgeJson;
  poly: PolygonJson;
}

export interface PolygonJson {
  nodes: NodeJson[];
  edges: EdgeJson[];
}

export interface MarkingJson {
  position: NodeJson;
  direction: EdgeJson;
  type: MarkingType;
}
