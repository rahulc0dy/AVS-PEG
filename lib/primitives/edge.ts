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

export class Edge {
  n1: Node;
  n2: Node;
  isDirected: boolean;
  private line: Line<BufferGeometry, LineBasicMaterial> | null;

  constructor(n1: Node, n2: Node, isDirected = false) {
    this.n1 = n1;
    this.n2 = n2;
    this.isDirected = isDirected;
    this.line = null;
  }

  length(): number {
    return distance(this.n1, this.n2);
  }

  directionVector(): Node {
    return normalize(subtract(this.n2, this.n1));
  }

  equals(edge: Edge): boolean {
    return this.includes(edge.n1) && this.includes(edge.n2);
  }

  includes(node: Node): boolean {
    return this.n1.equals(node) || this.n2.equals(node);
  }

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

  draw(group: Group, config: { width: number; color: Color }) {
    if (!this.line) {
      const edgeGeometry = new BufferGeometry();
      edgeGeometry.setAttribute(
        "position",
        new Float32BufferAttribute(
          [this.n1.x, 0, this.n1.y, this.n2.x, 0, this.n2.y],
          3
        )
      );

      const edgeMaterial = new LineBasicMaterial({
        color: config.color,
        linewidth: config.width,
      });

      this.line = new Line(edgeGeometry, edgeMaterial);
    } else {
      const positionAttribute = this.line.geometry.getAttribute(
        "position"
      ) as Float32BufferAttribute;
      positionAttribute.setXYZ(0, this.n1.x, 0, this.n1.y);
      positionAttribute.setXYZ(1, this.n2.x, 0, this.n2.y);
      positionAttribute.needsUpdate = true;

      const material = this.line.material as LineBasicMaterial;
      material.color.copy(config.color);
      material.linewidth = config.width;
    }

    const line = this.line;
    if (line && !group.children.includes(line)) {
      group.add(line);
    }
  }

  dispose() {
    if (this.line) {
      this.line.geometry.dispose();
      this.line.material.dispose();
      this.line = null;
    }
  }
}
