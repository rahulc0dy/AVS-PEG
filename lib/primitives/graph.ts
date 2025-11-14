import { Color, Group } from "three";
import { Edge } from "@/lib/primitives/edge";
import { Node } from "@/lib/primitives/node";

export class Graph {
  private nodes: Node[];
  private edges: Edge[];

  constructor(nodes: Node[], edges: Edge[]) {
    this.nodes = nodes;
    this.edges = edges;
  }

  getNodes(): Node[] {
    return this.nodes;
  }

  private addNode(node: Node) {
    this.nodes.push(node);
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
    this.nodes.splice(this.nodes.indexOf(node), 1);
  }

  private addEdge(edge: Edge) {
    this.edges.push(edge);
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
    this.edges.splice(this.edges.indexOf(edge), 1);
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
      node.draw(group, { size: 0.2, color: new Color(0xffffff) });
    }
  }
}
