/**
 * Result returned by `getIntersection` when two segments intersect.
 * - `x`, `y`: intersection coordinates
 * - `offset`: parameter along the first segment (A->B) where the intersection lies (0..1)
 */
export type Intersection = { x: number; y: number; offset: number };

export type LabelledIntersection = {
  intersection: Intersection;
  label: "traffic" | "border";
};
