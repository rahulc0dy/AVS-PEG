import { Graph } from "@/lib/primitives/graph";
import { Node } from "@/lib/primitives/node";
import { angle, distance, getNearestEdge } from "@/utils/math";
import { Edge } from "@/lib/primitives/edge";
import { Polygon } from "@/lib/primitives/polygon";
import { Envelope } from "@/lib/primitives/envelope";
import { ROAD_WIDTH } from "@/env";
import { BoxGeometry, Color, Group, Mesh, MeshBasicMaterial } from "three";

/**
 * Finds the shortest sequence of Edge objects connecting two positions on a Graph.
 * Uses Dijkstra's algorithm over graph nodes with edge length as the weight.
 */
export class PathFindingSystem {
  private graph: Graph;

  private path: Edge[] = [];
  private pathBorders: Edge[] = [];

  private needsRedraw: boolean = false;
  private pathBorderMeshes: Mesh[] = [];

  constructor(graph: Graph) {
    this.graph = graph;
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
      this.setPath([startEdge]);
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
    this.setPath([]);
    let cursor: Node | null = endNode;
    while (cursor && !cursor.equals(startNode)) {
      const e: Edge | null = prevEdge.get(cursor as Node) ?? null;
      const p: Node | null = prevNode.get(cursor as Node) ?? null;
      if (!e || !p) break; // incomplete
      this.path.unshift(e);
      cursor = p;
    }

    if (!cursor || !cursor.equals(startNode)) {
      console.log("Failed to reconstruct path");
      this.setPath([]);
      return;
    }

    this.updatePathPolygon();

    return;
  }

  private setPath(path: Edge[]) {
    this.path = path;
    this.updatePathPolygon();
  }

  /**
   * Return the most recently computed path (edge list).
   */
  public getPath(): Edge[] {
    return this.path;
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
    this.needsRedraw = true;
  }

  private updatePathPolygon() {
    const pathEnvelopes: Envelope[] = [];
    for (const edge of this.path) {
      pathEnvelopes.push(new Envelope(edge, ROAD_WIDTH, 8));
    }

    this.pathBorders = Polygon.union(
      pathEnvelopes.map((envelope) => envelope.poly),
    );

    this.needsRedraw = true;
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

  draw(group: Group) {
    if (this.needsRedraw || this.pathBorderMeshes.length === 0) {
      this.dispose();

      const roadBorderMaterial = new MeshBasicMaterial({
        color: new Color(0x00ff00),
        transparent: true,
        opacity: 0.5,
      });

      for (const edge of this.pathBorders) {
        const roadBorderHeight = 10;
        const roadBorderGeometry = new BoxGeometry(
          distance(edge.n1, edge.n2),
          roadBorderHeight,
          1,
        );
        const pathBorderMesh = new Mesh(roadBorderGeometry, roadBorderMaterial);

        pathBorderMesh.position.set(
          (edge.n1.x + edge.n2.x) / 2,
          roadBorderHeight / 2,
          (edge.n1.y + edge.n2.y) / 2,
        );
        pathBorderMesh.rotation.y = -angle(
          new Node(edge.n2.x - edge.n1.x, edge.n2.y - edge.n1.y),
        );

        this.pathBorderMeshes.push(pathBorderMesh);

        group.add(pathBorderMesh);
      }

      this.needsRedraw = false;
    } else {
      for (const mesh of this.pathBorderMeshes) {
        if (!mesh.parent) {
          group.add(mesh);
        }
      }
    }
  }

  dispose() {
    for (const mesh of this.pathBorderMeshes) {
      mesh.geometry.dispose();
      (mesh.material as MeshBasicMaterial).dispose();
      if (mesh.parent) {
        mesh.parent.remove(mesh);
      }
    }
    this.pathBorderMeshes = [];
  }
}
