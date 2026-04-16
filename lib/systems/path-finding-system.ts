import { Graph } from "@/lib/primitives/graph";
import { Node } from "@/lib/primitives/node";
import { distance, getNearestEdge } from "@/utils/math";
import { Edge } from "@/lib/primitives/edge";
import { Polygon } from "@/lib/primitives/polygon";
import { Envelope } from "@/lib/primitives/envelope";
import { ROAD_WIDTH } from "@/env";
import { Color, Group } from "three";
import { Path } from "../markings/path";

/**
 * Finds the shortest sequence of Edge objects connecting two positions on a Graph.
 * Uses Dijkstra's algorithm over graph nodes with edge length as the weight.
 */
export class PathFindingSystem {
  private graph: Graph;

  private path: Edge[] = [];
  private pathBorders: Edge[] = [];

  private paths: Path[] = [];

  constructor(graph: Graph) {
    this.graph = graph;
  }

  public setPaths(paths: Path[]) {
    this.paths = paths;
  }

  /**
   * Compute a path between two positions.
   *
   * The function updates the internal `this.path` with the found edges.
   * Use `getPath()` to retrieve the computed path after calling this method.
   * If no valid path exists, `this.path` is cleared to an empty array.
   *
   * @param srcPos - starting position (Node-like object with coordinates)
   * @param destPos - destination position (Node-like object with coordinates)
   */
  public findPath(srcPos: Node, destPos: Node) {
    const edges = this.graph.getEdges();
    const startEdge = getNearestEdge(srcPos, edges);
    const endEdge = getNearestEdge(destPos, edges);

    if (!startEdge || !endEdge) {
      console.log("No valid start or end edge found");
      this.setPath([]);
      return;
    }

    // If both points lie on the same edge, that's trivially the path.
    if (startEdge.equals(endEdge)) {
      // Orient the edge from source toward destination
      const distSrcToN1 = distance(srcPos, startEdge.n1);
      const distSrcToN2 = distance(srcPos, startEdge.n2);
      const distDestToN1 = distance(destPos, startEdge.n1);
      const distDestToN2 = distance(destPos, startEdge.n2);

      // Determine which endpoint is closer to source and which to destination
      const sourceEnd =
        distSrcToN1 <= distSrcToN2 ? startEdge.n1 : startEdge.n2;
      const destEnd =
        distDestToN1 <= distDestToN2 ? startEdge.n1 : startEdge.n2;

      // If source and dest are at opposite ends, orient n1->n2 from source to dest
      // If they're at the same end (edge case), just use the original orientation
      const orientedEdge = sourceEnd.equals(destEnd)
        ? startEdge
        : new Edge(sourceEnd, destEnd, startEdge.isDirected);

      this.setPath([orientedEdge]);
      return;
    }

    const nodes = this.graph.getNodes();

    // Build adjacency list and run Dijkstra
    const adjacency = this.buildAdjacency(nodes, edges);

    const startNode =
      distance(srcPos, startEdge.n1) <= distance(srcPos, startEdge.n2)
        ? startEdge.n1
        : startEdge.n2;
    const endNode =
      distance(destPos, endEdge.n1) <= distance(destPos, endEdge.n2)
        ? endEdge.n1
        : endEdge.n2;

    const { dist, prevEdge, prevNode } = this.runDijkstra(
      adjacency,
      nodes,
      startNode,
      endNode,
    );

    if ((dist.get(endNode) ?? Infinity) === Infinity) {
      console.log("No path found between the specified points");
      this.setPath([]);
      return;
    }

    // Reconstruct path (edges) from endNode back to startNode
    // We need to orient each edge in the direction of travel: from prevNode -> cursor
    this.setPath([]);
    let cursor: Node | null = endNode;
    while (cursor && !cursor.equals(startNode)) {
      const e: Edge | null = prevEdge.get(cursor as Node) ?? null;
      const p: Node | null = prevNode.get(cursor as Node) ?? null;
      if (!e || !p) break; // incomplete

      // Create an oriented edge from p (previous node) to cursor (current node)
      // This ensures the edge points in the direction of travel
      const orientedEdge = new Edge(p, cursor, e.isDirected);
      this.path.unshift(orientedEdge);
      cursor = p;
    }

    if (!cursor || !cursor.equals(startNode)) {
      console.log("Failed to reconstruct path");
      this.setPath([]);
      return;
    }

    // Check if we need to prepend startEdge (when source and startNode are not at the same location)
    // startEdge connects source position to the graph, and may not be part of the Dijkstra path
    if (!this.path.some((edge) => edge.equals(startEdge))) {
      // Orient startEdge from startNode toward the first node in the path
      const firstPathNode =
        this.path.length > 0
          ? this.path[0].n2 // n2 is the destination of the first edge, i.e., the node after startNode
          : startEdge.n1.equals(startNode)
            ? startEdge.n2
            : startEdge.n1;

      const orientedStartEdge = new Edge(
        startNode,
        firstPathNode,
        startEdge.isDirected,
      );
      this.path.unshift(orientedStartEdge);
    }

    this.updatePathPolygon();

    return;
  }

  public calculatePaths() {
    this.paths.forEach((_path) => {
      // For each path, we can calculate the path edges and borders based on the waypoints.
      // Update {this.paths} itself with the new edges and borders for each path.
    });
  }

  /**
   * Return the most recently computed path (edge list).
   */
  public getPath(): Edge[] {
    return this.path;
  }

  public getPaths(): Path[] {
    return this.paths;
  }

  public getPathBorders(): Edge[] {
    return this.pathBorders;
  }

  /**
   * Clears the current path.
   */
  public reset() {
    this.path = [];
    this.pathBorders = [];
  }

  draw(group: Group) {
    // Draw flat green lines using the standard Edge drawing method
    for (const edge of this.pathBorders) {
      edge.draw(group, { width: 8, color: new Color(0x00ff00) });
    }
  }

  dispose() {
    // Clean up edge meshes if the Edge class holds internal geometries
    for (const edge of this.pathBorders) {
      if ("dispose" in edge && typeof edge.dispose === "function") {
        edge.dispose();
      }
    }

    this.pathBorders = [];
  }

  private setPath(path: Edge[]) {
    this.path = path;
    this.updatePathPolygon();
  }

  private updatePathPolygon() {
    const pathEnvelopes: Envelope[] = [];
    for (const edge of this.path) {
      pathEnvelopes.push(new Envelope(edge, ROAD_WIDTH, 8));
    }

    this.pathBorders = Polygon.union(
      pathEnvelopes.map((envelope) => envelope.poly),
    );
  }

  /**
   * Build an adjacency map for the graph.
   *
   * Each map entry maps a Node to an array of neighbor objects containing the
   * traversing Edge, the neighbor Node, and the edge weight.
   */
  private buildAdjacency(
    nodes: Node[],
    edges: Edge[],
  ): Map<Node, { edge: Edge; neighbor: Node; weight: number }[]> {
    const adjacency = new Map<
      Node,
      { edge: Edge; neighbor: Node; weight: number }[]
    >();

    for (const n of nodes) adjacency.set(n, []);

    for (const e of edges) {
      const a = e.n1;
      const b = e.n2;
      const w = e.length();
      if (e.isDirected) {
        adjacency.get(a)?.push({ edge: e, neighbor: b, weight: w });
      } else {
        adjacency.get(a)?.push({ edge: e, neighbor: b, weight: w });
        adjacency.get(b)?.push({ edge: e, neighbor: a, weight: w });
      }
    }

    return adjacency;
  }

  /**
   * Run Dijkstra's algorithm over the adjacency map.
   *
   * Returns the distance map and predecessor maps needed to reconstruct the path.
   */
  private runDijkstra(
    adjacency: Map<Node, { edge: Edge; neighbor: Node; weight: number }[]>,
    nodes: Node[],
    startNode: Node,
    endNode: Node,
  ): {
    dist: Map<Node, number>;
    prevEdge: Map<Node, Edge | null>;
    prevNode: Map<Node, Node | null>;
  } {
    const dist = new Map<Node, number>();
    const prevEdge = new Map<Node, Edge | null>();
    const prevNode = new Map<Node, Node | null>();

    for (const n of nodes) {
      dist.set(n, Infinity);
      prevEdge.set(n, null);
      prevNode.set(n, null);
    }
    dist.set(startNode, 0);

    const unvisited = new Set(nodes);

    while (unvisited.size > 0) {
      // extract-min over unvisited (simple linear scan)
      let u: Node | null = null;
      let best = Infinity;
      for (const cand of unvisited) {
        const d = dist.get(cand) ?? Infinity;
        if (d < best) {
          best = d;
          u = cand;
        }
      }

      if (u === null || best === Infinity) break; // remaining nodes unreachable

      // stop early if we reached the target
      if (u.equals(endNode)) break;

      unvisited.delete(u);

      const neighbors = adjacency.get(u) ?? [];
      for (const { edge, neighbor, weight } of neighbors) {
        if (!unvisited.has(neighbor)) continue;
        const alt = (dist.get(u) ?? Infinity) + weight;
        if (alt < (dist.get(neighbor) ?? Infinity)) {
          dist.set(neighbor, alt);
          prevEdge.set(neighbor, edge);
          prevNode.set(neighbor, u);
        }
      }
    }

    return { dist, prevEdge, prevNode };
  }
}
