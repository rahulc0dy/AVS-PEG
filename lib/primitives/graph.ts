import { Color, Group } from "three";
import { Edge } from "@/lib/primitives/edge";
import { Node } from "@/lib/primitives/node";

export class Graph {
  private nodes: Node[];
  private edges: Edge[];
  private changes: number;

  constructor(nodes: Node[], edges: Edge[]) {
    this.nodes = nodes;
    this.edges = edges;
    this.changes = 0;
  }

  private incChanges() {
    this.changes += 1;
  }

  getChanges(): number {
    return this.changes;
  }

  touch() {
    this.incChanges();
  }

  getNodes(): Node[] {
    return this.nodes;
  }

  private addNode(node: Node) {
    this.nodes.push(node);
    this.incChanges();
  }

  containsNode(node: Node) {
    return this.nodes.find((p) => p.equals(node));
  }

  tryAddNode(node: Node): Node | null {
    if (!this.containsNode(node)) {
      this.addNode(node);
      return node;
    }
    return null;
  }

  removeNode(node: Node) {
    const edges = this.getEdgesWithNode(node);
    for (const edge of edges) {
      this.removeEdge(edge);
    }

    const nodeIndex = this.nodes.indexOf(node);
    if (nodeIndex != -1) {
      this.nodes.splice(nodeIndex, 1);
      this.incChanges;
    }
  }

  getEdges(): Edge[] {
    return this.edges;
  }

  private addEdge(edge: Edge) {
    this.edges.push(edge);
    this.incChanges();
  }

  containsEdge(edge: Edge) {
    return this.edges.find((e) => e.equals(edge));
  }

  tryAddEdge(edge: Edge) {
    if (!this.containsEdge(edge) && !edge.n1.equals(edge.n2)) {
      this.addEdge(edge);
      return true;
    }
    return false;
  }

  removeEdge(edge: Edge) {
    const edgeIndex = this.edges.indexOf(edge);
    if (edgeIndex !== -1) {
      const [removedEdge] = this.edges.splice(edgeIndex, 1);
      removedEdge.dispose();
      this.incChanges();
    }
  }

  getEdgesWithNode(node: Node) {
    const edges = [];
    for (const edge of this.edges) {
      if (edge.includes(node)) {
        edges.push(edge);
      }
    }
    return edges;
  }

  draw(group: Group) {
    for (const node of this.nodes) {
      node.draw(group, { size: 10, color: new Color(0xffffff) });
    }
  }
}
