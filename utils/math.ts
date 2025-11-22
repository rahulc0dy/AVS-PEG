import { Node } from "@/lib/primitives/node";
import { Polygon } from "@/lib/primitives/polygon";

/**
 * Euclidean distance between two nodes.
 * @param n1 - first point
 * @param n2 - second point
 */
export function distance(n1: Node, n2: Node): number {
  return Math.hypot(n1.x - n2.x, n1.y - n2.y);
}

/** Component-wise addition of two nodes. */
export function add(n1: Node, n2: Node): Node {
  return new Node(n1.x + n2.x, n1.y + n2.y);
}

/** Component-wise subtraction (n1 - n2). */
export function subtract(n1: Node, n2: Node): Node {
  return new Node(n1.x - n2.x, n1.y - n2.y);
}

/** Midpoint between two nodes. */
export function average(n1: Node, n2: Node): Node {
  return new Node((n1.x + n2.x) / 2, (n1.y + n2.y) / 2);
}

/** Magnitude (length) of a node vector. */
export function magnitude(n: Node): number {
  return Math.hypot(n.x, n.y);
}

/** Scale a node vector by a scalar. */
export function scale(n: Node, scaler: number): Node {
  return new Node(n.x * scaler, n.y * scaler);
}

/**
 * Normalize a vector to unit length.
 * Returns the zero vector when input has zero length (safe fallback).
 */
export function normalize(n: Node): Node {
  const mag = magnitude(n);
  if (mag === 0) {
    // Fallback: return zero vector unchanged
    return new Node(0, 0);
  }
  return scale(n, 1 / mag);
}

/** Dot product of two node vectors. */
export function dot(n1: Node, n2: Node): number {
  return n1.x * n2.x + n1.y * n2.y;
}

/** Linear interpolation between two scalar values. */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function invLerp(a: number, b: number, v: number): number {
  if (a == b) return 0;
  return (v - a) / (b - a);
}

/** Angle (radians) of a node vector measured from +X axis. */
export function angle(node: Node): number {
  return Math.atan2(node.y, node.x);
}

export function degToRad(degree: number): number {
  return (degree * Math.PI) / 180;
}

/** Translate a point by angle (radians) and distance (offset). */
export function translate(loc: Node, angle: number, offset: number): Node {
  return new Node(
    loc.x + Math.cos(angle) * offset,
    loc.y + Math.sin(angle) * offset
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
 */
export function getIntersection(
  A: Node,
  B: Node,
  C: Node,
  D: Node
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
 * Returns the matching `Node` or `null` when none is found within the threshold.
 */
export function getNearestNode(
  loc: Node,
  nodes: Node[],
  threshold: number = Number.MAX_SAFE_INTEGER
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
