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
 * Represents a closed polygon defined by ordered vertices.
 *
 * - `nodes` are expected to be in winding order (clockwise or counter-clockwise).
 * - `edges` connect consecutive nodes and wrap from the last node back to the first.
 *
 * This class is used primarily for *simple* shapes (envelopes/roads) where
 * midpoint-based containment heuristics are acceptable.
 */
export class Polygon {
  /** Ordered list of polygon vertices (2D points). */
  nodes: Node[];
  /** Edges connecting consecutive nodes (closed loop). */
  edges: Edge[];

  /** Cached Three.js mesh used for filled rendering; created lazily. */
  private mesh: Mesh<ShapeGeometry, MeshBasicMaterial> | null = null;

  /** Cached axis-aligned bounding box (AABB) for fast rejection checks. */
  private boundingBox: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  } | null = null;

  /**
   * Create a polygon from either an ordered array of {@link Node}s (vertices)
   * or an array of {@link Edge}s (pre-built edges forming a closed loop).
   *
   * - When called with `Node[]`, edges are constructed by connecting consecutive
   *   nodes and closing the loop.
   * - When called with `Edge[]`, the polygon uses the supplied edges (shallow-copied)
   *   and derives its node list from the edges' `n1` vertices.
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
   * Computes the union outline (as edges) of multiple polygons.
   *
   * ### Side effects
   * This call mutates the provided polygons. {@link Polygon.multiBreak} splits
   * intersecting edges in-place, so clone your polygons beforehand if
   * immutability is required.
   *
   * ### Containment heuristic
   * {@link Polygon.containsEdge} uses an edge-midpoint point-in-polygon test.
   * This works well for the convex/simple envelopes used in this project, but
   * it can fail for concave shapes or edges that only touch the boundary.
   *
   * @param polygons - Polygons to union
   * @returns Edges representing the outer boundary after union
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
          if (i === j) continue;

          // if edge can't be inside polygon's bbox, skip
          if (!polygons[j].isEdgeInBoundingBox(edge)) continue;

          if (polygons[j].containsEdge(edge)) {
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
   *
   * @param polygons - Polygons to split in-place
   */
  static multiBreak(polygons: Polygon[]): void {
    for (let i = 0; i < polygons.length - 1; i++) {
      for (let j = i + 1; j < polygons.length; j++) {
        if (polygons[i].boundingBoxOverlaps(polygons[j])) {
          Polygon.break(polygons[i], polygons[j]);
        }
      }
    }
  }

  /**
   * Break two polygons at their pairwise edge intersections.
   *
   * When an intersection is found (excluding endpoints), a new {@link Node}
   * is inserted at the intersection and both edges are split so the
   * intersection becomes an explicit vertex shared by both polygons.
   *
   * This mutates `poly1` and `poly2` in-place.
   *
   * @param poly1 - First polygon (mutated)
   * @param poly2 - Second polygon (mutated)
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

          poly1.boundingBox = null;
          poly2.boundingBox = null;
        }
      }
    }
  }

  /**
   * Compute the shortest distance from a point to this polygon (min over edges).
   *
   * @param node - External point
   * @returns Minimum distance to any edge of the polygon
   */
  distanceToNode(node: Node): number {
    return Math.min(...this.edges.map((edge) => edge.distanceToNode(node)));
  }

  /**
   * Computes the axis-aligned bounding box (AABB) of this polygon.
   *
   * The bounding box is cached after first computation. Call {@link dispose}
   * to clear the cache if the polygon geometry changes.
   *
   * @returns Min/max X and Y coordinates of the bounding box
   */
  getBoundingBox(): { minX: number; maxX: number; minY: number; maxY: number } {
    // Return cached bounding box if available
    if (this.boundingBox) {
      return this.boundingBox;
    }

    // Handle empty polygon case
    if (this.nodes.length === 0) {
      this.boundingBox = { minX: 0, maxX: 0, minY: 0, maxY: 0 };
      return this.boundingBox;
    }

    // Initialize with extreme values to find actual min/max
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    // Scan all nodes to find bounding extents
    for (const node of this.nodes) {
      if (node.x < minX) minX = node.x;
      if (node.x > maxX) maxX = node.x;
      if (node.y < minY) minY = node.y;
      if (node.y > maxY) maxY = node.y;
    }

    // Cache and return the computed bounding box
    this.boundingBox = { minX, maxX, minY, maxY };
    return this.boundingBox;
  }

  /**
   * Checks if this polygon's bounding box overlaps with another polygon's
   * bounding box.
   *
   * Fast early-rejection test used before more expensive intersection checks.
   * Two AABBs overlap if they intersect on both the X and Y axes.
   *
   * @param other - The other polygon to test against
   * @returns `true` if bounding boxes overlap, `false` otherwise
   */
  boundingBoxOverlaps(other: Polygon): boolean {
    const a = this.getBoundingBox();
    const b = other.getBoundingBox();

    // Check for separation on X axis
    if (a.maxX < b.minX || b.maxX < a.minX) return false;
    // Check for separation on Y axis
    if (a.maxY < b.minY || b.maxY < a.minY) return false;

    // Bounding boxes overlap on both axes
    return true;
  }

  /**
   * Checks whether an edge's midpoint lies within this polygon's bounding box.
   *
   * This is a fast preliminary test before more expensive containment checks.
   * A point inside the bounding box may or may not be inside the actual polygon.
   *
   * Note: Despite the older name, this method does *not* check the whole edge—
   * only the edge midpoint.
   *
   * @param edge - Edge to test
   * @returns `true` if the edge midpoint is within the bounding box (inclusive)
   */
  isEdgeInBoundingBox(edge: Edge): boolean {
    const bbox = this.getBoundingBox();
    const midpoint = average(edge.n1, edge.n2);
    return (
      midpoint.x >= bbox.minX &&
      midpoint.x <= bbox.maxX &&
      midpoint.y >= bbox.minY &&
      midpoint.y <= bbox.maxY
    );
  }

  /**
   * Compute the shortest distance between this polygon and another polygon.
   *
   * Approximated by checking distance from each edge start point to the other
   * polygon. This is sufficient for many simple/convex cases used in the app,
   * but it is not a mathematically complete poly-to-poly distance.
   *
   * @remarks
   * This is a convenience utility used by some tools/experiments and may not be
   * referenced by the main app at all times.
   *
   * @param polygon - Other polygon
   * @returns Minimum pairwise distance
   */
  distanceToPoly(polygon: Polygon): number {
    return Math.min(
      ...this.edges.map((edge) => polygon.distanceToNode(edge.n1)),
    );
  }

  /**
   * Determine whether this polygon intersects another polygon (any edge pair intersects).
   *
   * @remarks
   * This is a convenience utility used by some tools/experiments and may not be
   * referenced by the main app at all times.
   *
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
   * Heuristic containment test for an edge: checks whether the edge midpoint is
   * inside this polygon.
   *
   * @param edge - Edge to test
   * @returns `true` if midpoint is inside the polygon
   */
  containsEdge(edge: Edge): boolean {
    const midpoint = average(edge.n1, edge.n2);
    return this.containsNode(midpoint);
  }

  /**
   * Point-in-polygon test using the ray-casting (odd-even) rule.
   *
   * Casts a ray from the query point to a sufficiently far "outer" point and
   * counts intersections with polygon edges.
   *
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
   * Create or update a filled Three.js {@link Mesh} representing the polygon and
   * add it to the provided {@link Group}.
   *
   * The mesh is created lazily. When created, it is rotated to lie on the X–Z
   * plane and slightly offset in Y to reduce z-fighting.
   *
   * @param group - Scene group to add the mesh to
   * @param config - Rendering config
   * @param config.fillColor - Fill color for the polygon surface
   */
  draw(group: Group, config: { fillColor: Color }): void {
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
   * and clear cached data (mesh, bounding box).
   */
  dispose(): void {
    if (this.mesh) {
      this.mesh.geometry.dispose();
      this.mesh.material.dispose();
      this.mesh = null;
    }
    this.boundingBox = null;
  }

  /**
   * Serialize the polygon to JSON.
   *
   * @returns A {@link PolygonJson}-compatible payload
   */
  toJson(): PolygonJson {
    return {
      nodes: this.nodes.map((n) => n.toJson()),
      edges: this.edges.map((e) => e.toJson()),
    };
  }

  /**
   * Restore polygon geometry from JSON.
   *
   * Disposes any cached mesh so the visual is recreated on the next draw.
   *
   * @param json - Serialized polygon data
   */
  fromJson(json: PolygonJson): void {
    this.dispose();

    this.nodes = json.nodes.map((n) => {
      const node = new Node(0, 0);
      node.fromJson(n);
      return node;
    });

    this.edges = json.edges
      .filter((e) => {
        // Find matching nodes from this.nodes by coordinates
        const n1 = this.nodes.find((n) => n.x === e.n1.x && n.y === e.n1.y);
        const n2 = this.nodes.find((n) => n.x === e.n2.x && n.y === e.n2.y);

        if (!n1 || !n2) {
          console.log("Edge references node not found in polygon");
          return false;
        }
        return true;
      })
      .map((e) => {
        const n1 = this.nodes.find((n) => n.x === e.n1.x && n.y === e.n1.y)!;
        const n2 = this.nodes.find((n) => n.x === e.n2.x && n.y === e.n2.y)!;

        const edge = new Edge(n1, n2);
        if (e.isDirected !== undefined) {
          edge.isDirected = e.isDirected;
        }
        return edge;
      });
  }
}
