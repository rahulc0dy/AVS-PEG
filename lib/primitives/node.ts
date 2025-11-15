import { Color, Group, Mesh, MeshBasicMaterial, SphereGeometry } from "three";

export class Node {
  x: number;
  y: number;
  private mesh: Mesh<SphereGeometry, MeshBasicMaterial> | null;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
    this.mesh = null;
  }

  equals(node: Node) {
    return this.x == node.x && this.y == node.y;
  }

  draw(group: Group, config: { size: number; color: Color }) {
    if (!this.mesh) {
      const geometry = new SphereGeometry(config.size);
      const material = new MeshBasicMaterial({ color: config.color });
      this.mesh = new Mesh(geometry, material);
    }

    const sphere = this.mesh;
    sphere.position.set(this.x, 0, this.y);
    group.add(sphere);
  }

  dispose() {
    if (this.mesh) {
      this.mesh.geometry.dispose();
      this.mesh.material.dispose();
      this.mesh = null;
    }
  }
}
