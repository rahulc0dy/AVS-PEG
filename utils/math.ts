import { Node } from "@/lib/primitives/node";

function distance(n1: Node, n2: Node): number {
  return Math.hypot(n1.x - n2.x, n1.y - n2.y);
}

function add(n1: Node, n2: Node): Node {
  return new Node(n1.x + n2.x, n1.y + n2.y);
}

function subtract(n1: Node, n2: Node): Node {
  return new Node(n1.x - n2.x, n1.y - n2.y);
}

function average(n1: Node, n2: Node): Node {
  return new Node((n1.x + n2.x) / 2, (n1.y + n2.y) / 2);
}

function magnitude(n: Node): number {
  return Math.hypot(n.x, n.y);
}

function scale(n: Node, scaler: number): Node {
  return new Node(n.x * scaler, n.y * scaler);
}

function normalize(n: Node): Node {
  const mag = magnitude(n);
  if (mag === 0) {
    // Fallback: return zero vector unchanged
    return new Node(0, 0);
  }
  return scale(n, 1 / mag);
}

function dot(n1: Node, n2: Node): number {
  return n1.x * n2.x + n1.y * n2.y;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function angle(node: Node): number {
  return Math.atan2(node.y, node.x);
}

function translate(loc: Node, angle: number, offset: number): Node {
  return new Node(
    loc.x + Math.cos(angle) * offset,
    loc.y + Math.sin(angle) * offset
  );
}

type Intersection = { x: number; y: number; offset: number };

function getIntersection(
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

function getNearestNode(
  loc: Node,
  nodes: Node[],
  threshold: number = Number.MAX_SAFE_INTEGER
): Node | null {
  let minDistance = Number.MAX_SAFE_INTEGER;
  let nearestNode = null;
  for (const node of nodes) {
    const dist = distance(loc, node);
    if (dist < minDistance && dist < threshold) {
      minDistance = dist;
      nearestNode = node;
    }
  }
  return nearestNode;
}

export {
  distance,
  add,
  subtract,
  average,
  normalize,
  scale,
  magnitude,
  dot,
  getIntersection,
  angle,
  translate,
  getNearestNode,
};
