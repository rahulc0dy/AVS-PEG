import { Node } from "@/lib/primitives/node";
import {
  distance,
  subtract,
  normalize,
  add,
  scale,
  magnitude,
  dot,
} from "@/utils/math";
import {
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  Group,
  Line,
  LineBasicMaterial,
} from "three";

/**
 * Represents an edge between two `Node`s.
 *
 * The edge supports geometric queries (length, projection, distance to a
 * point) and simple rendering as a Three.js `Line` added to a `Group`.
 */
export class Edge {
  /** Start node for the edge. */
  n1: Node;
  /** End node for the edge. */
  n2: Node;
  /** Whether the edge is directed. */
  isDirected: boolean;

  /** Cached Three.js `Line` used for rendering. Created lazily on first draw. */
  private line: Line<BufferGeometry, LineBasicMaterial> | null;

  /**
   * Create an Edge between `n1` and `n2`.
   * @param n1 - Start node
   * @param n2 - End node
   * @param isDirected - Whether the edge is directed (default: `false`)
   */
  constructor(n1: Node, n2: Node, isDirected = false) {
    this.n1 = n1;
    this.n2 = n2;
    this.isDirected = isDirected;
    this.line = null;
  }

  /**
   * Get the Euclidean length of the edge.
   * @returns Edge length
   */
  length(): number {
    return distance(this.n1, this.n2);
  }

  /**
   * Compute the (unit) direction vector pointing from `n1` to `n2`.
   * @returns Normalized vector as a `Node`-like object
   */
  directionVector(): Node {
    return normalize(subtract(this.n2, this.n1));
  }

  /**
   * Check if this edge equals another edge (shares the same two endpoints,
   * order-insensitive).
   * @param edge - Edge to compare
   * @returns `true` if both endpoints match
   */
  equals(edge: Edge): boolean {
    return this.includes(edge.n1) && this.includes(edge.n2);
  }

  /**
   * Check whether the provided `node` is one of the endpoints of this edge.
   * @param node - Node to test
   * @returns `true` if `node` equals `n1` or `n2`
   */
  includes(node: Node): boolean {
    return this.n1.equals(node) || this.n2.equals(node);
  }

  /**
   * Compute the shortest distance from `node` to this segment.
   * If the perpendicular projection of `node` onto the infinite line lies
   * within the segment, the perpendicular distance is returned. Otherwise the
   * distance to the nearest endpoint is returned.
   * @param node - External node
   * @returns Shortest distance from `node` to this edge
   */
  distanceToNode(node: Node): number {
    // Get the projection of the given node onto the edge
    const projection = this.projectNode(node);

    // If the projection lies within the segment (not beyond either endpoint)
    const isWithinSegment = projection.offset > 0 && projection.offset < 1;
    if (isWithinSegment) {
      // The shortest distance is the perpendicular distance to the edge
      return distance(node, projection.point);
    }

    // Otherwise, the closest distance is to one of the endpoints
    const distanceToStart = distance(node, this.n1);
    const distanceToEnd = distance(node, this.n2);

    return Math.min(distanceToStart, distanceToEnd);
  }

  /**
   * Project an external `node` onto the infinite line defined by this edge,
   * and return both the projected point and the offset ratio along the
   * segment. Offset is 0 at `n1` and 1 at `n2`.
   *
   * @param node - Node to project
   * @returns Object containing `point` (projected Node) and `offset` (ratio)
   */
  projectNode(node: Node): { point: Node; offset: number } {
    // Vector from the start of the edge (n1) to the external point
    const vectorToNode = subtract(node, this.n1);

    // Vector representing the edge itself (from n1 to n2)
    const edgeVector = subtract(this.n2, this.n1);

    // Unit direction vector along the edge
    const edgeDirection = normalize(edgeVector);

    // Scalar projection: how far along the edge the point projects (in units of length)
    const projectionLength = dot(vectorToNode, edgeDirection);

    // Actual coordinates of the projected node on the infinite line
    const projectedNode = add(this.n1, scale(edgeDirection, projectionLength));

    // Offset ratio along the segment: 0 = at n1, 1 = at n2
    const offsetRatio = projectionLength / magnitude(edgeVector);

    return {
      point: projectedNode,
      offset: offsetRatio,
    };
  }

  /**
   * Render the edge as a `Line` and add it to the provided `Group`.
   * The geometry is created lazily and position updates reuse the existing
   * attribute. The `config.width` controls `linewidth` and `config.color`
   * controls the material color.
   *
   * @param group - Three.js `Group` to add the line to
   * @param config - Rendering configuration
   * @param config.width - Line width (passed to material.linewidth)
   * @param config.color - Line color
   */
  draw(group: Group, config: { width: number; color: Color }) {
    // Lazy-create geometry + material on first draw. We store two points
    // (start and end) in a single Float32 buffer attribute with 3 components
    // per vertex: [x1, y1, z1, x2, y2, z2]. Using a single attribute lets us
    // update the positions later without recreating the geometry.
    if (!this.line) {
      const edgeGeometry = new BufferGeometry();
      edgeGeometry.setAttribute(
        "position",
        new Float32BufferAttribute(
          [this.n1.x, 0, this.n1.y, this.n2.x, 0, this.n2.y],
          3
        )
      );

      // Create a basic line material. Some renderers ignore `linewidth`, so
      // we still pass color but treat line width as a hint rather than a
      // guaranteed setting across all platforms.
      const edgeMaterial = new LineBasicMaterial({
        color: config.color,
        linewidth: config.width,
      });

      this.line = new Line(edgeGeometry, edgeMaterial);
    } else {
      // Reuse the existing position buffer to avoid reallocating geometry on
      // every frame. `setXYZ` updates the attribute values for each vertex
      // (index 0 -> start, index 1 -> end), and `needsUpdate` signals Three.js
      // to upload the changed buffer to the GPU.
      const positionAttribute = this.line.geometry.getAttribute(
        "position"
      ) as Float32BufferAttribute;
      positionAttribute.setXYZ(0, this.n1.x, 0, this.n1.y);
      positionAttribute.setXYZ(1, this.n2.x, 0, this.n2.y);
      positionAttribute.needsUpdate = true;

      // Update material color to match the requested config. Note: many
      // WebGL renderers do not support changing line width via material, so
      // this may be a no-op on some platforms; color updates are reliable.
      const material = this.line.material as LineBasicMaterial;
      material.color.copy(config.color);
      material.linewidth = config.width;
    }

    // Add the line to the group only once. `group.children.includes` avoids
    // duplicating the object in the scene graph if `draw` is called repeatedly.
    if (this.line && !group.children.includes(this.line)) {
      group.add(this.line);
    }
  }

  /**
   * Dispose of Three.js resources used by this edge (geometry and material)
   * and clear the cached line reference.
   */
  dispose() {
    if (this.line) {
      this.line.geometry.dispose();
      this.line.material.dispose();
      this.line = null;
    }
  }
}
