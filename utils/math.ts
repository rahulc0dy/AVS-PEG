import { Edge } from "@/lib/primitives/edge";
import { Node } from "@/lib/primitives/node";
import { Polygon } from "@/lib/primitives/polygon";

/**
 * Euclidean distance between two nodes.
 *
 * @param n1 - first point
 * @param n2 - second point
 */
export function distance(n1: Node, n2: Node): number {
  return Math.hypot(n1.x - n2.x, n1.y - n2.y);
}

/**
 * Component-wise addition of two nodes.
 *
 * @param n1 - first node
 * @param n2 - second node
 * @returns a new `Node` representing `n1 + n2`
 */
export function add(n1: Node, n2: Node): Node {
  return new Node(n1.x + n2.x, n1.y + n2.y);
}

/**
 * Component-wise subtraction (n1 - n2).
 *
 * @param n1 - minuend node
 * @param n2 - subtrahend node
 * @returns a new `Node` representing `n1 - n2`
 */
export function subtract(n1: Node, n2: Node): Node {
  return new Node(n1.x - n2.x, n1.y - n2.y);
}

/**
 * Midpoint between two nodes.
 *
 * @param n1 - first point
 * @param n2 - second point
 * @returns a new `Node` at the midpoint of `n1` and `n2`
 */
export function average(n1: Node, n2: Node): Node {
  return new Node((n1.x + n2.x) / 2, (n1.y + n2.y) / 2);
}

/**
 * Magnitude (length) of a node vector.
 *
 * @param n - vector node
 * @returns the Euclidean length of `n`
 */
export function magnitude(n: Node): number {
  return Math.hypot(n.x, n.y);
}

/**
 * Scale a node vector by a scalar.
 *
 * @param n - input vector
 * @param scaler - scalar multiplier
 * @returns a new `Node` scaled by `scaler`
 */
export function scale(n: Node, scaler: number): Node {
  return new Node(n.x * scaler, n.y * scaler);
}

/**
 * Normalize a vector to unit length. Returns the zero vector when input has
 * zero length (safe fallback).
 *
 * @param n - input vector
 * @returns a new `Node` normalized to length 1, or the zero vector if input
 * has zero magnitude
 */
export function normalize(n: Node): Node {
  const mag = magnitude(n);
  if (mag === 0) {
    // Fallback: return zero vector unchanged
    return new Node(0, 0);
  }
  return scale(n, 1 / mag);
}

/**
 * Dot product of two node vectors.
 *
 * @param n1 - first vector
 * @param n2 - second vector
 * @returns the scalar dot product `n1 · n2`
 */
export function dot(n1: Node, n2: Node): number {
  return n1.x * n2.x + n1.y * n2.y;
}

/**
 * Compute a perpendicular vector to the input vector.
 * Returns a normalized vector rotated 90 degrees counter-clockwise.
 *
 * @param n - input vector
 * @returns a new normalized `Node` perpendicular to `n`
 */
export function perpendicular(n: Node): Node {
  const perp = new Node(-n.y, n.x);
  return normalize(perp);
}

/**
 * Linear interpolation between two scalar values.
 *
 * @param a - start value
 * @param b - end value
 * @param t - interpolation parameter (commonly 0..1)
 * @returns interpolated value at `t`
 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Inverse linear interpolation.
 *
 * Given a range `[a, b]` and a value `v`, returns the normalized parameter
 * `t` such that `lerp(a, b, t) === v` when `a !== b`.
 *
 * Returns `0` when `a === b` to avoid division by zero.
 *
 * @param a - start of range
 * @param b - end of range
 * @param v - value within the range
 * @returns normalized parameter between -Infinity..+Infinity (commonly 0..1)
 */
export function invLerp(a: number, b: number, v: number): number {
  if (a === b) return 0;
  return (v - a) / (b - a);
}

/**
 * Angle (radians) of a node vector measured from the +X axis.
 *
 * @param node - input vector
 * @returns angle in radians (range -PI..PI)
 */
export function angle(node: Node): number {
  return Math.atan2(node.y, node.x);
}

/**
 * Convert degrees to radians.
 *
 * @param degree - angle in degrees
 * @returns angle in radians
 */
export function degToRad(degree: number): number {
  return (degree * Math.PI) / 180;
}

/**
 * Translate a point by an angle (radians) and distance (offset).
 *
 * @param loc - starting location
 * @param angle - direction in radians
 * @param offset - distance to translate
 * @returns a new `Node` translated from `loc` by the given angle and offset
 */
export function translate(loc: Node, angle: number, offset: number): Node {
  return new Node(
    loc.x + Math.cos(angle) * offset,
    loc.y + Math.sin(angle) * offset,
  );
}

/**
 * Result returned by `getIntersection` when two segments intersect.
 * - `x`, `y`: intersection coordinates
 * - `offset`: parameter along the first segment (A->B) where the intersection lies (0..1)
 */
export type Intersection = { x: number; y: number; offset: number };

/**
 * Compute the intersection point (if any) between segments AB and CD.
 * Returns `null` when segments are parallel, coincident, or do not intersect
 * within their finite ranges. Uses a small EPSILON to tolerate floating-point
 * imprecision when testing for parallelism.
 *
 * @param A - first endpoint of segment AB
 * @param B - second endpoint of segment AB
 * @param C - first endpoint of segment CD
 * @param D - second endpoint of segment CD
 * @returns an `Intersection` object when segments intersect, otherwise `null`
 */
export function getIntersection(
  A: Node,
  B: Node,
  C: Node,
  D: Node,
): Intersection | null {
  // Compute determinants for intersection formulas
  const tNumerator = (D.x - C.x) * (A.y - C.y) - (D.y - C.y) * (A.x - C.x);
  const uNumerator = (C.y - A.y) * (A.x - B.x) - (C.x - A.x) * (A.y - B.y);
  const denominator = (D.y - C.y) * (B.x - A.x) - (D.x - C.x) * (B.y - A.y);

  const EPSILON = 0.001; // small threshold to handle floating-point precision

  // If denominator ≈ 0, lines are parallel or coincident
  if (Math.abs(denominator) <= EPSILON) return null;

  // Compute normalized intersection parameters
  const t = tNumerator / denominator;
  const u = uNumerator / denominator;

  // Check if intersection point lies within both line segments
  const isWithinSegment = t >= 0 && t <= 1 && u >= 0 && u <= 1;
  if (!isWithinSegment) return null;

  // Compute intersection coordinates using linear interpolation
  const x = lerp(A.x, B.x, t);
  const y = lerp(A.y, B.y, t);

  return { x, y, offset: t };
}

/**
 * Test whether two polygons intersect.
 *
 * This performs an edge-edge intersection test by checking every segment of
 * `polyA` against every segment of `polyB`. The function returns `true` as
 * soon as any pair of segments intersect. This is a conservative and simple
 * test; it does not check for polygon containment without edge intersections
 * (use additional winding/point-in-polygon checks if containment must be
 * detected).
 *
 * @param polyA - first polygon
 * @param polyB - second polygon
 * @returns `true` when any edges intersect, otherwise `false`
 */
export function doPolygonsIntersect(polyA: Polygon, polyB: Polygon): boolean {
  for (let i = 0; i < polyA.nodes.length; i++) {
    const a1 = polyA.nodes[i];
    const a2 = polyA.nodes[(i + 1) % polyA.nodes.length];
    for (let j = 0; j < polyB.nodes.length; j++) {
      const b1 = polyB.nodes[j];
      const b2 = polyB.nodes[(j + 1) % polyB.nodes.length];
      if (getIntersection(a1, a2, b1, b2)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Find the nearest node to `loc` within an optional `threshold`.
 *
 * Returns the matching `Node` or `null` when none is found within the threshold.
 *
 * @param loc - query location
 * @param nodes - candidate nodes to search
 * @param threshold - maximum allowed distance (defaults to a very large value)
 * @returns the nearest `Node` within `threshold`, or `null` if none found
 */
export function getNearestNode(
  loc: Node,
  nodes: Node[],
  threshold: number = Number.MAX_SAFE_INTEGER,
): Node | null {
  let minDistance = Number.MAX_SAFE_INTEGER;
  let nearestNode: Node | null = null;
  for (const node of nodes) {
    const dist = distance(loc, node);
    if (dist < minDistance && dist < threshold) {
      minDistance = dist;
      nearestNode = node;
    }
  }
  return nearestNode;
}

/**
 * Find the nearest edge to `loc` within an optional `threshold`.
 *
 * Searches `edges` and returns the closest `Edge` whose distance to `loc`
 * is less than `threshold`. Returns `null` when no edge is within the
 * threshold.
 *
 * @param loc - query location
 * @param edges - candidate edges to search
 * @param threshold - maximum allowed distance (defaults to `Number.MAX_SAFE_INTEGER`)
 * @returns nearest `Edge` within `threshold`, or `null` if none found
 */
export function getNearestEdge(
  loc: Node,
  edges: Edge[],
  threshold = Number.MAX_SAFE_INTEGER,
): Edge | null {
  let minDist = Number.MAX_SAFE_INTEGER;
  let nearest: Edge | null = null;
  for (const seg of edges) {
    const dist = seg.distanceToNode(loc);
    if (dist < minDist && dist < threshold) {
      minDist = dist;
      nearest = seg;
    }
  }
  return nearest;
}
