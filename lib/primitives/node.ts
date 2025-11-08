export class Node {
  x: number;
  y: number;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }

  equals(node: Node) {
    return this.x == node.x && this.y == node.y;
  }
}
