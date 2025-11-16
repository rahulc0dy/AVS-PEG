import { Color, Group, Mesh, MeshBasicMaterial, SphereGeometry } from "three";

/**
 * A simple 3D node represented as a sphere placed on the X-Z plane.
 *
 * The node stores 2D coordinates (`x`, `y`) where `y` corresponds to the
 * Z axis in Three.js. The rendered sphere is positioned at `(x, 0, y)`.
 */
export class Node {
  /** X coordinate in world space (maps to Three.js X). */
  x: number;
  /** Y coordinate in world space (maps to Three.js Z when drawing). */
  y: number;

  /**
   * Cached Three.js mesh used for rendering the node. Created lazily on first draw.
   * Cleared when `dispose()` is called.
   */
  private mesh: Mesh<SphereGeometry, MeshBasicMaterial> | null;

  /**
   * Create a new Node at 2D coordinates (`x`, `y`).
   * @param x - X coordinate in world space
   * @param y - Y coordinate in world space (will be used as Z for drawing)
   */
  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
    this.mesh = null;
  }

  /**
   * Check equality with another node by comparing coordinates.
   * @param node - Node to compare against
   * @returns `true` if both `x` and `y` match exactly
   */
  equals(node: Node) {
    return this.x === node.x && this.y === node.y;
  }

  /**
   * Draw the node as a sphere and add it to the provided group.
   *
   * The implementation caches a unit sphere mesh and controls the visible
   * size via `scale` so repeated draws avoid recreating geometry/material.
   * The sphere is positioned at `(x, 0, y)`.
   *
   * @param group - Three.js `Group` to add the node's mesh to
   * @param config - Rendering config
   * @param config.size - Scale to apply to the unit sphere (controls visual radius)
   * @param config.color - Color to apply to the sphere's material
   */
  draw(group: Group, config: { size: number; color: Color }) {
    if (!this.mesh) {
      // Use unit sphere and drive size via scale so we can update it per draw.
      const geometry = new SphereGeometry(1);
      const material = new MeshBasicMaterial();
      this.mesh = new Mesh(geometry, material);
    }

    const sphere = this.mesh;
    sphere.position.set(this.x, 0, this.y);
    sphere.scale.set(config.size, config.size, config.size);
    sphere.material.color.copy(config.color);

    group.add(sphere);
  }

  /**
   * Dispose of Three.js resources used by this node (geometry and material)
   * and clear the cached mesh reference.
   */
  dispose() {
    if (this.mesh) {
      this.mesh.geometry.dispose();
      this.mesh.material.dispose();
      this.mesh = null;
    }
  }
}
