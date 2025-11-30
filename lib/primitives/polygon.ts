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
import { PolygonJson } from "@/types/save";

/**
 * Represents a closed polygon defined by ordered nodes.
 * Each consecutive pair of nodes forms an edge, and the polygon closes back to the first node.
 */
export class Polygon {
  /** Ordered list of polygon vertices (2D points). */
  nodes: Node[];
  /** Edges connecting consecutive nodes (closed loop). */
  edges: Edge[];

  /** Cached Three.js mesh used for filled rendering; created lazily. */
  private mesh: Mesh<ShapeGeometry, MeshBasicMaterial> | null = null;

  /**
   * Create a polygon from either an ordered array of `Node`s (vertices) or an
   * array of `Edge`s (pre-built edges forming a closed loop).
   *
   * When called with `Node[]`, edges are constructed by connecting consecutive
   * nodes and closing the loop. When called with `Edge[]`, the polygon will use
   * the supplied edges (shallow-copied) and derive its node list from the
   * edges' `n1` vertices.
   */
  constructor(nodes: Node[]);
  constructor(edges: Edge[]);
  constructor(nodesOrEdges: Node[] | Edge[]) {
    if (!nodesOrEdges || nodesOrEdges.length === 0) {
      this.nodes = [];
      this.edges = [];
      return;
    }

    // Detect whether we received an Edge[] (edge objects have `n1` property)
    if ("n1" in nodesOrEdges[0]) {
      const edges = nodesOrEdges as Edge[];
      // Copy edges to avoid accidental external mutation and derive nodes
      this.edges = edges.slice();
      this.nodes = edges.map((e) => e.n1);
    } else {
      const nodes = nodesOrEdges as Node[];
      this.nodes = nodes;
      this.edges = [];

      // Create edges by connecting consecutive nodes (and closing the loop)
      for (let i = 0; i < nodes.length; i++) {
        const start = nodes[i];
        const end = nodes[(i + 1) % nodes.length]; // wraps around to the first node
        this.edges.push(new Edge(start, end));
      }
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
   * Break all polygons at pairwise intersections so that intersecting
   * edges are split and share common intersection nodes.
   * @param polygons - Array of polygons to split in-place
   */
  static multiBreak(polygons: Polygon[]): void {
    for (let i = 0; i < polygons.length - 1; i++) {
      for (let j = i + 1; j < polygons.length; j++) {
        Polygon.break(polygons[i], polygons[j]);
      }
    }
  }

  /**
   * Break two polygons at their pairwise edge intersections. When an
   * intersection is found (excluding endpoints), a new `Node` is inserted
   * at the intersection and both edges are split so the intersection becomes
   * an explicit vertex shared by both polygons.
   *
   * This mutates `poly1` and `poly2` in-place.
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
          edges2[j].n2,
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
   * Compute the shortest distance from `node` to this polygon (min over edges).
   * @param node - External point
   * @returns Minimum distance to any edge of the polygon
   */
  distanceToNode(node: Node): number {
    return Math.min(...this.edges.map((edge) => edge.distanceToNode(node)));
  }

  /**
   * Compute the shortest distance between this polygon and another polygon.
   * Approximated by checking distance from each edge's start point to the
   * other polygon (sufficient for many simple/convex cases).
   * @param polygon - Other polygon
   * @returns Minimum pairwise distance
   */
  distanceToPoly(polygon: Polygon): number {
    return Math.min(
      ...this.edges.map((edge) => polygon.distanceToNode(edge.n1)),
    );
  }

  /**
   * Determine whether this polygon intersects `polygon` (any edge pair intersects).
   * @param polygon - Other polygon
   * @returns `true` when an intersection exists
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
   * Heuristic containment test for an edge: check whether the edge's
   * midpoint lies inside this polygon. NOTE: This is a midpoint heuristic
   * and can give false positives/negatives for concave polygons or edges
   * that touch the boundary.
   * @param edge - Edge to test
   * @returns `true` if midpoint is inside the polygon
   */
  containsEdge(edge: Edge): boolean {
    const midpoint = average(edge.n1, edge.n2);
    return this.containsNode(midpoint);
  }

  /**
   * Point-in-polygon test using the ray-casting (odd-even) rule. Casts a
   * ray from the query point to a sufficiently far "outer" point and counts
   * intersections with polygon edges.
   * @param node - Point to test
   * @returns `true` when the point is inside the polygon
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

  /**
   * Create or update a filled Three.js `Mesh` representing the polygon and
   * add it to the provided `Group`.
   *
   * The mesh is created lazily. When created, the polygon is rotated to lie
   * on the X-Z plane and slightly offset in Y to reduce z-fighting.
   *
   * @param group - Scene group to add the mesh to
   * @param config - Rendering config (fillColor)
   */
  draw(group: Group, config: { fillColor: Color }) {
    if (!this.mesh) {
      const material = new MeshBasicMaterial({
        color: config.fillColor,
        side: BackSide, // The polygon is flipped, the backside is visible
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
      this.mesh.position.y = -0.01; // Slightly below to avoid z-fighting
    } else {
      this.mesh.material.color.copy(config.fillColor);
    }

    if (!group.children.includes(this.mesh)) {
      group.add(this.mesh);
    }
  }

  /**
   * Dispose of any Three.js resources held by this polygon (geometry + material)
   * and clear the cached mesh reference.
   */
  dispose() {
    if (this.mesh) {
      this.mesh.geometry.dispose();
      this.mesh.material.dispose();
      this.mesh = null;
    }
  }

  /**
   * Serialize the polygon to JSON (nodes and edges).
   */
  toJson() {
    return {
      nodes: this.nodes.map((n) => n.toJson()),
      edges: this.edges.map((e) => e.toJson()),
    };
  }

  /**
   * Restore polygon geometry from JSON. Disposes any cached mesh so the
   * visual is recreated on the next draw.
   * @param json Serialized polygon data
   */
  fromJson(json: PolygonJson) {
    this.dispose();

    this.nodes = json.nodes.map((n) => {
      const node = new Node(0, 0);
      node.fromJson(n);
      return node;
    });

    this.edges = json.edges.map((e) => {
      const edge = new Edge(new Node(0, 0), new Node(0, 0));
      edge.fromJson(e);
      return edge;
    });
  }
}
