import { Color, Group, Mesh, MeshBasicMaterial, SphereGeometry } from "three";

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
    const geometry = new SphereGeometry(config.size);
    const material = new MeshBasicMaterial({ color: config.color });
    const sphere = new Mesh(geometry, material);
    sphere.position.set(this.x, 0, this.y);

    group.add(sphere);
  }
}
