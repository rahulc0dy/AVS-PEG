import { Node } from "@/lib/primitives/node";
import { Edge } from "@/lib/primitives/edge";
import {
  BufferGeometry,
  Camera,
  Intersection,
  Line,
  LineBasicMaterial,
  LineDashedMaterial,
  Material,
  Mesh,
  MeshStandardMaterial,
  Plane,
  Raycaster,
  Scene,
  SphereGeometry,
  Vector2,
  Vector3,
} from "three";

type GraphEvents = {
  onChange?: () => void;
};

type AddNodeOptions = {
  connectToPrevious?: boolean;
};

export class GraphEditor {
  private nodes: Node[] = [];
  private edges: Edge[] = [];
  private selected: Node | null = null;
  private hovered: Node | null = null;
  private dragging = false;
  private onChange: () => void = () => {};

  constructor(events: GraphEvents = {}) {
    this.setOnChange(events.onChange);
  }

  setOnChange(callback?: () => void) {
    this.onChange = callback ?? (() => {});
  }

  getNodes(): Node[] {
    return this.nodes.slice();
  }

  getEdges(): Edge[] {
    return this.edges.slice();
  }

  getSelected(): Node | null {
    return this.selected;
  }

  getHovered(): Node | null {
    return this.hovered;
  }

  addNode(node: Node, options: AddNodeOptions = {}) {
    const { connectToPrevious = true } = options;
    const previous = this.nodes[this.nodes.length - 1] ?? null;

    this.nodes.push(node);

    if (connectToPrevious && previous && previous !== node) {
      this.addEdgeInternal(previous, node);
    }

    this.selected = node;
    this.hovered = node;
    this.notify();
  }

  addEdge(n1: Node, n2: Node) {
    if (!this.nodes.includes(n1) || !this.nodes.includes(n2)) return;
    if (n1 == n2) return;
    if (this.hasEdge(n1, n2)) return;

    this.edges.push(new Edge(n1, n2));
    this.notify();
  }

  moveNode(node: Node, x: number, y: number) {
    if (!this.nodes.includes(node)) return;
    if (node.x === x && node.y === y) return;

    node.x = x;
    node.y = y;
    this.notify();
  }

  removeNode(node: Node) {
    const index = this.nodes.indexOf(node);
    if (index === -1) return;

    this.nodes.splice(index, 1);
    this.edges = this.edges.filter(
      (edge) => edge.n1 !== node && edge.n2 !== node
    );

    if (this.selected === node) this.selected = null;
    if (this.hovered === node) this.hovered = null;

    this.notify();
  }

  removeEdge(edge: Edge) {
    const index = this.edges.indexOf(edge);
    if (index == -1) return;
    this.edges.splice(index, 1);
    this.notify();
  }

  selectNode(node: Node | null) {
    if (this.selected === node) return;
    if (node && !this.nodes.includes(node)) return;

    this.selected = node;
    this.notify();
  }

  setHovered(node: Node | null) {
    if (this.hovered === node) return;
    if (node && !this.nodes.includes(node)) return;

    this.hovered = node;
    this.notify();
  }

  clear() {
    this.nodes = [];
    this.edges = [];
    this.selected = null;
    this.hovered = null;
    this.notify();
  }

  dispose() {
    this.clear();
  }

  private addEdgeInternal(n1: Node, n2: Node) {
    if (!this.nodes.includes(n1) || !this.nodes.includes(n2)) return;
    if (n1 === n2) return;
    if (this.hasEdge(n1, n2)) return;

    this.edges.push(new Edge(n1, n2));
  }

  private hasEdge(n1: Node, n2: Node): boolean {
    return this.edges.some(
      (edge) =>
        (edge.n1 === n1 && edge.n2 === n2) || (edge.n1 === n2 && edge.n2 === n1)
    );
  }

  private notify() {
    this.onChange();
  }
}
