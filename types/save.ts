import { LightState } from "@/lib/markings/traffic-light";
import { MarkingType } from "./marking";

/**
 * Serialized representation of the entire world used for saving/loading.
 */
export interface WorldJson {
  /** The road graph (nodes + edges). */
  graph: GraphJson;
  /** Traffic light graph (nodes + edges) used by the traffic light editor/system. */
  trafficLightGraph: GraphJson;
  /** Road width used when constructing envelopes. */
  roadWidth: number;
  /** Sampling/roundness value used for envelope end caps. */
  roadRoundness: number;
  /** All markings present in the world. */
  markings: MarkingJson[];
  /** Borders derived from unioning envelopes. */
  roadBorders: EdgeJson[];
  /** Road envelopes (polygons) generated from edges. */
  roads: EnvelopeJson[];
}

/**
 * Serialized graph containing nodes and edges.
 */
export interface GraphJson {
  nodes: NodeJson[];
  edges: EdgeJson[];
}

/**
 * 2D point in world coordinates.
 */
export interface NodeJson {
  x: number;
  y: number;
}

/**
 * Serialized edge between two nodes.
 */
export interface EdgeJson {
  n1: NodeJson;
  n2: NodeJson;
  isDirected: boolean;
}

/**
 * Serialized road segment extending EdgeJson with lane information.
 */
export interface RoadJson extends EdgeJson {
  /** Number of lanes on the road segment (defaults to 2 if not specified). */
  laneCount?: number;
  /** Road type from OSM (e.g., 'primary', 'secondary', 'residential'). */
  roadType?: string;
}

/**
 * Traffic light-specific serialized marking.
 * Extends the base `MarkingJson` with an explicit `lightState`.
 */
export interface TrafficLightJson extends MarkingJson {
  lightState: LightState;
}

/**
 * Serialized envelope (road) containing a skeleton edge and polygon outline.
 */
export interface EnvelopeJson {
  skeleton: EdgeJson;
  poly: PolygonJson;
}

/**
 * Polygon represented by nodes and connecting edges.
 */
export interface PolygonJson {
  nodes: NodeJson[];
  edges: EdgeJson[];
}

/**
 * Base serialized marking.
 */
export interface MarkingJson {
  /** World position of the marking. */
  position: NodeJson;
  /** Direction vector / orientation encoded as a node-like object. */
  direction: NodeJson;
  /** Marking type discriminator. */
  type: MarkingType;
  /** Optional URL to a 3D model used to represent the marking. */
  modelUrl?: string;
}
