/**
 * Types of markings supported by the system.
 *
 * - `traffic-light`: a marking representing a traffic light (placement/controller).
 * - `source`: a start point marking used for routing/simulation.
 * - `destination`: an end point marking used for routing/simulation.
 * - `default`: a generic or unspecified marking type.
 */
export type MarkingType =
  | "traffic-light"
  | "source"
  | "destination"
  | "stop-sign"
  | "default";

export type GraphEdgeType = "directed" | "undirected";

export type SourceDestinationMarkingType = "source" | "destination";
