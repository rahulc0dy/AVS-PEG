/**
 * Result returned by `getIntersection` when two segments intersect.
 */
export type Intersection = { x: number; y: number; offset: number };

// Expand the labels to support our markings
export type IntersectionLabel =
  | "traffic"
  | "border"
  | "stop-sign"
  | "traffic-light-red"
  | "traffic-light-yellow"
  | "traffic-light-green"
  | string;

export type LabelledIntersection = {
  intersection: Intersection;
  label: IntersectionLabel;
};
