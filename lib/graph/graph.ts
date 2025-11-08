import { GraphEdge, GraphNode, GraphSnapshot, NodeId, EdgeId } from "./types";

export class Graph {
  private nodesMap: Map<NodeId, GraphNode> = new Map();
  private edgesMap: Map<EdgeId, GraphEdge> = new Map();

  constructor(initial?: GraphSnapshot) {
    if (initial) {
      initial.nodes.forEach((n) => this.nodesMap.set(n.id, { ...n }));
      initial.edges.forEach((e) => this.edgesMap.set(e.id, { ...e }));
    }
  }

  snapshot(): GraphSnapshot {
    return {
      nodes: Array.from(this.nodesMap.values()).map((n) => ({ ...n })),
      edges: Array.from(this.edgesMap.values()).map((e) => ({ ...e })),
    };
  }

  hasNode(id: NodeId): boolean {
    return this.nodesMap.has(id);
  }

  getNode(id: NodeId): GraphNode | undefined {
    const n = this.nodesMap.get(id);
    return n ? { ...n } : undefined;
  }

  addNode(node: Omit<GraphNode, "id"> & { id?: NodeId }): GraphNode {
    const id = node.id ?? this.genId("n");
    const toAdd: GraphNode = {
      id,
      x: node.x,
      y: node.y,
      z: node.z,
      label: node.label,
    };
    this.nodesMap.set(id, toAdd);
    return { ...toAdd };
  }

  updateNodePosition(
    id: NodeId,
    x: number,
    y: number,
    z: number
  ): GraphNode | undefined {
    const n = this.nodesMap.get(id);
    if (!n) return undefined;
    n.x = x;
    n.y = y;
    n.z = z;
    return { ...n };
  }

  removeNode(id: NodeId): boolean {
    if (!this.nodesMap.has(id)) return false;
    // Remove incident edges
    for (const [eid, e] of Array.from(this.edgesMap.entries())) {
      if (e.source === id || e.target === id) this.edgesMap.delete(eid);
    }
    return this.nodesMap.delete(id);
  }

  addEdge(
    edge: Omit<GraphEdge, "id"> & { id?: EdgeId }
  ): GraphEdge | undefined {
    if (!this.nodesMap.has(edge.source) || !this.nodesMap.has(edge.target))
      return undefined;
    const id = edge.id ?? this.genId("e");
    const toAdd: GraphEdge = {
      id,
      source: edge.source,
      target: edge.target,
      directed: edge.directed,
      weight: edge.weight,
    };
    this.edgesMap.set(id, toAdd);
    return { ...toAdd };
  }

  removeEdge(id: EdgeId): boolean {
    return this.edgesMap.delete(id);
  }

  edgesForNode(id: NodeId): GraphEdge[] {
    const res: GraphEdge[] = [];
    for (const e of this.edgesMap.values()) {
      if (e.source === id || e.target === id) res.push({ ...e });
    }
    return res;
  }

  private genId(prefix: string): string {
    return `${prefix}_${Math.random()
      .toString(36)
      .slice(2)}_${Date.now().toString(36)}`;
  }
}
