/**
 * OSM API JSON response (Overpass) containing nodes/ways/relations.
 */
export interface OsmResponse {
  version: number;
  generator: string;
  osm3s: Osm3s;
  elements: Element[];
}

/**
 * Metadata returned by the OSM API.
 */
export interface Osm3s {
  timestamp_osm_base: string; // ISO 8601
  copyright?: string;
}

/**
 * Element union representing node/way/relation entries in the OSM response.
 */
export type Element = NodeElement | WayElement | RelationElement;

/**
 * Common fields shared by OSM elements.
 */
export interface BaseElement {
  type: string;
  id: number;
  tags?: Tags;
}

/**
 * Node element (point) with latitude/longitude.
 */
export interface NodeElement extends BaseElement {
  type: "node";
  lat: number;
  lon: number;
  // Accept extra properties that may be present in some responses.
  [extra: string]: unknown;
}

/**
 * Way element composed of an ordered list of node IDs.
 */
export interface WayElement extends BaseElement {
  type: "way";
  nodes: number[];
}

/**
 * Relation element (not typically used for basic highway extracts but
 * included for completeness).
 */
export interface RelationElement extends BaseElement {
  type: "relation";
  members?: RelationMember[];
}

export interface RelationMember {
  type: "node" | "way" | "relation";
  ref: number;
  role?: string;
}

/** Generic tags map (key -> string value) */
export interface Tags {
  [key: string]: string;
}

// Type guards for runtime narrowing
export const isNode = (el: Element): el is NodeElement => el.type === "node";
export const isWay = (el: Element): el is WayElement => el.type === "way";
export const isRelation = (el: Element): el is RelationElement =>
  el.type === "relation";

/**
 * Convenience: extract all ways that have a `highway` tag from a response.
 */
export const getHighwayWays = (resp: OsmResponse): WayElement[] =>
  resp.elements.filter(
    (e): e is WayElement => isWay(e) && !!e.tags && "highway" in e.tags
  );
