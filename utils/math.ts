import { Node } from "@/lib/primitives/node.js";

function distance(n1: Node, n2: Node): number {
  return Math.hypot(n1.x - n2.x, n1.y - n2.y);
}

function add(n1: Node, n2: Node): Node {
  return new Node(n1.x + n2.x, n1.y + n2.y);
}

function subtract(n1: Node, n2: Node): Node {
  return new Node(n1.x - n2.x, n1.y - n2.y);
}

function magnitude(n: Node): number {
  return Math.hypot(n.x, n.y);
}

function scale(n: Node, scaler: number): Node {
  return new Node(n.x * scaler, n.y * scaler);
}

function normalize(n: Node): Node {
  return scale(n, 1 / magnitude(n));
}

function dot(n1: Node, n2: Node): number {
  return n1.x * n2.x + n1.y * n2.y;
}

export { distance, add, subtract, normalize, scale, magnitude, dot };
