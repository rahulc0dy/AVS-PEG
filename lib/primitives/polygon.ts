import { Node } from "@/lib/primitives/node.js";
import { Edge } from "@/lib/primitives/edge";
import { getIntersection, average } from "@/utils/math.js";

/**
 * Represents a closed polygon defined by ordered nodes.
 * Each consecutive pair of nodes forms an edge, and the polygon closes back to the first node.
 */
export class Polygon {
  nodes: Node[];
  edges: Edge[];

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
   * Breaks polygons at intersections, then keeps only the outermost edges.
   * Returns an array of edges that form the resulting union shape.
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
   * Does this by testing the midpoint of the edge.
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
    const outerPoint = new Node(-1000, 1000); // point far outside the polygon
    let intersectionCount = 0;

    for (const edge of this.edges) {
      const intersection = getIntersection(outerPoint, node, edge.n1, edge.n2);
      if (intersection) intersectionCount++;
    }

    // Odd count → inside; even count → outside
    return intersectionCount % 2 === 1;
  }
}
