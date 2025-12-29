import { Graph } from "@/lib/primitives/graph";
import { Node } from "@/lib/primitives/node";
import { getNearestEdge, distance } from "@/utils/math";
import { Edge } from "@/lib/primitives/edge";

export class PathFindingSystem {
  private graph: Graph;
  private path: Edge[] = [];

  constructor(graph: Graph) {
    this.graph = graph;
  }

  public findPath(srcPos: Node, destPos: Node) {
    const startEdge = getNearestEdge(srcPos, this.graph.getEdges());
    const endEdge = getNearestEdge(destPos, this.graph.getEdges());

    if (!startEdge || !endEdge) {
      console.log("No valid start or end edge found");
      return null; // No valid start or end edge found
    }

    console.log(startEdge, endEdge);

    // Quick case: if both points are on the same edge, return that edge
    if (startEdge.equals(endEdge)) return [startEdge];

    // Build adjacency list from graph edges
    const nodes = this.graph.getNodes();
    const adjacency = new Map<
      Node,
      { edge: Edge; neighbor: Node; weight: number }[]
    >();

    for (const n of nodes) adjacency.set(n, []);

    for (const e of this.graph.getEdges()) {
      const a = e.n1;
      const b = e.n2;
      const w = e.length();
      // directed edges: only a -> b
      if (e.isDirected) {
        adjacency.get(a)?.push({ edge: e, neighbor: b, weight: w });
      } else {
        adjacency.get(a)?.push({ edge: e, neighbor: b, weight: w });
        adjacency.get(b)?.push({ edge: e, neighbor: a, weight: w });
      }
    }

    // Choose the closer endpoint of each edge as the start/end node
    const startNode =
      distance(srcPos, startEdge.n1) <= distance(srcPos, startEdge.n2)
        ? startEdge.n1
        : startEdge.n2;
    const endNode =
      distance(destPos, endEdge.n1) <= distance(destPos, endEdge.n2)
        ? endEdge.n1
        : endEdge.n2;

    // Dijkstra initialization
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
      // extract-min over unvisited
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

    if ((dist.get(endNode) ?? Infinity) === Infinity) {
      console.log("No path found between the specified points");
      this.path = [];
      return; // no path
    }

    // Reconstruct path (edges) from endNode back to startNode
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
      this.path = [];
      return; // failed to reconstruct
    }
  }

  public getPath(): Edge[] {
    return this.path;
  }
}
