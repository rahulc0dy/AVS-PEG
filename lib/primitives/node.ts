import {
  BufferGeometry,
  Color,
  Group,
  Points,
  PointsMaterial,
  Vector3,
} from "three";

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

  draw(group: Group, config: { size: number; color: Color }) {
    const geometry = new BufferGeometry().setFromPoints([
      new Vector3(this.x, 0, this.y),
    ]);
    const material = new PointsMaterial({
      color: config.color,
      size: config.size,
    });
    const point = new Points(geometry, material);
    group.add(point);
  }
}
