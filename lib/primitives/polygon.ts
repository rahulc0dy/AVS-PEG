import { Node } from "@/lib/primitives/node";
import { Edge } from "@/lib/primitives/edge";
import { getIntersection, average } from "@/utils/math";
import {
  Color,
  Mesh,
  Group,
  MeshBasicMaterial,
  ShapeGeometry,
  Shape,
  BackSide,
} from "three";

/**
 * Represents a closed polygon defined by ordered nodes.
 * Each consecutive pair of nodes forms an edge, and the polygon closes back to the first node.
 */
export class Polygon {
  nodes: Node[];
  edges: Edge[];
  private mesh: Mesh<ShapeGeometry, MeshBasicMaterial> | null = null;

  constructor(nodes: Node[]) {
    this.nodes = nodes;
    this.edges = [];

    // Create edges by connecting consecutive nodes (and closing the loop)
    for (let i = 0; i < nodes.length; i++) {
      const start = nodes[i];
      const end = nodes[(i + 1) % nodes.length]; // wraps around to the first node
      this.edges.push(new Edge(start, end));
    }
  }

  /**
   * Computes the union of multiple polygons.
   *
   * Side effect: this call mutates the provided polygons. {@link Polygon.multiBreak}
   * splits intersecting edges in-place, so clone your polygons beforehand if
   * immutability is required.
   *
   * Containment heuristic: {@link Polygon.containsEdge} checks only the midpoint
   * of each edge. This works for convex/simple envelopes (e.g., rectangles) but
   * can fail for concave shapes or edges that merely touch. Ensure inputs meet
   * that precondition or swap in a more robust containment test before relying
   * on the result.
   */
  static union(polygons: Polygon[]): Edge[] {
    // Split all intersecting edges so polygons share common intersection nodes
    Polygon.multiBreak(polygons);

    const keptEdges: Edge[] = [];

    // Keep only edges that are not fully contained within another polygon
    for (let i = 0; i < polygons.length; i++) {
      for (const edge of polygons[i].edges) {
        let keep = true;

        // Compare this edge against all other polygons
        for (let j = 0; j < polygons.length; j++) {
          if (i !== j && polygons[j].containsEdge(edge)) {
            keep = false;
            break;
          }
        }

        if (keep) {
          keptEdges.push(edge);
        }
      }
    }

    return keptEdges;
  }

  /**
   * Breaks all polygons in the list at their intersection points.
   * This ensures edges are split wherever polygons intersect.
   */
  static multiBreak(polygons: Polygon[]): void {
    for (let i = 0; i < polygons.length - 1; i++) {
      for (let j = i + 1; j < polygons.length; j++) {
        Polygon.break(polygons[i], polygons[j]);
      }
    }
  }

  /**
   * Breaks two polygons wherever their edges intersect.
   * Adds new nodes at intersection points and splits affected edges.
   */
  static break(poly1: Polygon, poly2: Polygon): void {
    const edges1 = poly1.edges;
    const edges2 = poly2.edges;

    // Loop through all edge pairs
    for (let i = 0; i < edges1.length; i++) {
      for (let j = 0; j < edges2.length; j++) {
        const intersection = getIntersection(
          edges1[i].n1,
          edges1[i].n2,
          edges2[j].n1,
          edges2[j].n2
        );

        // If a valid intersection occurs not exactly at endpoints
        if (
          intersection &&
          intersection.offset > 0 &&
          intersection.offset < 1
        ) {
          const newNode = new Node(intersection.x, intersection.y);

          // Split edge1 at intersection
          const originalEnd1 = edges1[i].n2;
          edges1[i].n2 = newNode;
          edges1.splice(i + 1, 0, new Edge(newNode, originalEnd1));

          // Split edge2 at intersection
          const originalEnd2 = edges2[j].n2;
          edges2[j].n2 = newNode;
          edges2.splice(j + 1, 0, new Edge(newNode, originalEnd2));
        }
      }
    }
  }

  /**
   * Returns the shortest distance from a given node to this polygon.
   * Computed as the minimum distance from the node to any of the polygon's edges.
   */
  distanceToNode(node: Node): number {
    return Math.min(...this.edges.map((edge) => edge.distanceToNode(node)));
  }

  /**
   * Returns the shortest distance between this polygon and another polygon.
   * Computed as the minimum distance between any edge of this polygon
   * and the closest point on the other polygon.
   */
  distanceToPoly(polygon: Polygon): number {
    return Math.min(
      ...this.edges.map((edge) => polygon.distanceToNode(edge.n1))
    );
  }

  /**
   * Checks if this polygon intersects with another polygon.
   * True if any pair of edges from the two polygons intersect.
   */
  intersectsPoly(polygon: Polygon): boolean {
    for (const edge1 of this.edges) {
      for (const edge2 of polygon.edges) {
        if (getIntersection(edge1.n1, edge1.n2, edge2.n1, edge2.n2)) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Checks if a given edge lies inside this polygon.
   * Uses a midpoint test, which is reliable only for simple/convex polygons
   * where edges cannot “poke out” between vertices.
   */
  containsEdge(edge: Edge): boolean {
    const midpoint = average(edge.n1, edge.n2);
    return this.containsNode(midpoint);
  }

  /**
   * Checks if a given node (point) lies inside this polygon using
   * the ray-casting algorithm (odd–even rule).
   * Draws a line from the point to a far-away "outer" point and counts intersections.
   */
  containsNode(node: Node): boolean {
    const minX = Math.min(...this.nodes.map((n) => n.x));
    const maxY = Math.max(...this.nodes.map((n) => n.y));
    const outerPoint = new Node(minX - 1000, maxY + 1000);
    let intersectionCount = 0;

    for (const edge of this.edges) {
      const intersection = getIntersection(outerPoint, node, edge.n1, edge.n2);
      if (intersection) intersectionCount++;
    }

    // Odd count → inside; even count → outside
    return intersectionCount % 2 === 1;
  }

  draw(
    group: Group,
    config: { lineWidth: number; strokeColor: Color; fillColor: Color }
  ) {
    if (!this.mesh) {
      const material = new MeshBasicMaterial({
        color: config.fillColor,
        side: BackSide,
      });

      const shape = new Shape();
      if (this.nodes.length > 0) {
        shape.moveTo(this.nodes[0].x, this.nodes[0].y);
        for (let i = 1; i < this.nodes.length; i++) {
          shape.lineTo(this.nodes[i].x, this.nodes[i].y);
        }
      }
      const geometry = new ShapeGeometry(shape);
      this.mesh = new Mesh(geometry, material);
      this.mesh.rotation.x = Math.PI / 2;
      this.mesh.position.y = -0.01;
    } else {
      this.mesh.material.color.copy(config.fillColor);
    }

    if (!group.children.includes(this.mesh)) {
      group.add(this.mesh);
    }
  }

  dispose() {
    if (this.mesh) {
      this.mesh.geometry.dispose();
      this.mesh.material.dispose();
      this.mesh = null;
    }
  }
}
