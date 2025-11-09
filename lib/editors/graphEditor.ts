import * as THREE from "three";
import { Node } from "@/lib/primitives/node";
import { Edge } from "@/lib/primitives/edge";

type GraphEvents = {
  onChange?: (nodes: number, edges: number) => void;
};

export class GraphEditor {
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.Camera;
  private readonly dom: HTMLElement;
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();

  private readonly nodes = new Map<Node, THREE.Mesh>();
  private edges: Edge[] = [];
  private readonly edgeLines = new Map<Edge, THREE.Line>();

  private selected: Node | null = null;
  private hovered: Node | null = null;
  private dragging = false;
  private dragOffset = new THREE.Vector3();

  constructor(
    params: {
      scene: THREE.Scene;
      camera: THREE.Camera;
      dom: HTMLElement;
    } & GraphEvents
  ) {
    this.scene = params.scene;
    this.camera = params.camera;
    this.dom = params.dom;
    this.onChange = params.onChange ?? (() => {});
  }

  private onChange: (nodes: number, edges: number) => void;

  enable() {
    this.boundDown = this.handlePointerDown.bind(this);
    this.boundMove = this.handlePointerMove.bind(this);
    this.boundUp = this.handlePointerUp.bind(this);
    this.boundContext = (evt: PointerEvent) => evt.preventDefault();

    this.dom.addEventListener("pointerdown", this.boundDown);
    this.dom.addEventListener("pointermove", this.boundMove);
    this.dom.addEventListener("pointerup", this.boundUp);
    this.dom.addEventListener("contextmenu", this.boundContext);
  }

  disable() {
    this.dom.removeEventListener("pointerdown", this.boundDown);
    this.dom.removeEventListener("pointermove", this.boundMove);
    this.dom.removeEventListener("pointerup", this.boundUp);
    this.dom.removeEventListener("contextmenu", this.boundContext);
    this.dragging = false;
    this.hovered = null;
    this.selected = null;
  }

  dispose() {
    this.disable();
    this.nodes.forEach((mesh) => {
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
      this.scene.remove(mesh);
    });
    this.edgeLines.forEach((line) => {
      line.geometry.dispose();
      (line.material as THREE.Material).dispose();
      this.scene.remove(line);
    });
    this.nodes.clear();
    this.edges.length = 0;
    this.edgeLines.clear();
  }

  private boundDown!: (evt: PointerEvent) => void;
  private boundMove!: (evt: PointerEvent) => void;
  private boundUp!: (evt: PointerEvent) => void;
  private boundContext!: (evt: PointerEvent) => void;

  private updatePointer(evt: PointerEvent) {
    const rect = this.dom.getBoundingClientRect();
    this.pointer.x = ((evt.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((evt.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
  }

  private pickNode(): Node | undefined {
    const meshes = [...this.nodes.values()];
    const hit = this.raycaster.intersectObjects(meshes, false)[0];
    if (!hit) return undefined;
    for (const [node, mesh] of this.nodes) {
      if (mesh === hit.object) return node;
    }
    return undefined;
  }

  private handlePointerDown(evt: PointerEvent) {
    this.updatePointer(evt);
    const hit = this.pickNode();

    if (evt.button === 2) {
      if (hit) this.removeNode(hit);
      else this.selected = null;
      return;
    }

    if (evt.button !== 0) return;

    if (hit) {
      if (this.selected && this.selected !== hit) {
        this.addEdge(this.selected, hit);
        this.selected = hit;
      } else {
        this.selected = hit;
      }
      this.dragging = true;
      const mesh = this.nodes.get(hit)!;
      this.dragOffset.copy(mesh.position);
      return;
    }

    const point = this.raycaster.ray.origin
      .clone()
      .add(this.raycaster.ray.direction.clone().multiplyScalar(50));
    this.addNode(point);
  }

  private handlePointerMove(evt: PointerEvent) {
    this.updatePointer(evt);
    this.hovered = this.pickNode() ?? null;

    if (!this.dragging || !this.selected) return;
    const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    const newPos = new THREE.Vector3();
    this.raycaster.ray.intersectPlane(plane, newPos);
    this.moveNode(this.selected, newPos);
  }

  private handlePointerUp() {
    this.dragging = false;
  }

  private addNode(position: THREE.Vector3) {
    const node = new Node(position.x, position.y);
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(2, 16, 16),
      new THREE.MeshStandardMaterial({ color: 0x4e9cff })
    );
    mesh.position.copy(position);

    this.nodes.set(node, mesh);
    this.scene.add(mesh);
    this.selected = node;
    this.hovered = node;
    this.emitCounts();
  }

  private moveNode(node: Node, position: THREE.Vector3) {
    const mesh = this.nodes.get(node);
    if (!mesh) return;

    node.x = position.x;
    node.y = position.y;
    mesh.position.copy(position);

    this.edgeLines.forEach((line, edge) => {
      if (!edge.includes(node)) return;
      const pts = [
        new THREE.Vector3(edge.n1.x, edge.n1.y, 0),
        new THREE.Vector3(edge.n2.x, edge.n2.y, 0),
      ];
      line.geometry.setFromPoints(pts);
      line.geometry.attributes.position.needsUpdate = true;
    });
  }

  private addEdge(n1: Node, n2: Node) {
    const existing = this.edges.find((e) => e.equals(new Edge(n1, n2)));
    if (existing) return;

    const edge = new Edge(n1, n2);
    const geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(n1.x, n1.y, 0),
      new THREE.Vector3(n2.x, n2.y, 0),
    ]);
    const line = new THREE.Line(
      geometry,
      new THREE.LineDashedMaterial({ color: 0xffffff, dashSize: 2, gapSize: 1 })
    );
    line.computeLineDistances();

    this.edges.push(edge);
    this.edgeLines.set(edge, line);
    this.scene.add(line);
    this.emitCounts();
  }

  private removeNode(node: Node) {
    const mesh = this.nodes.get(node);
    if (mesh) {
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
      this.scene.remove(mesh);
      this.nodes.delete(node);
    }

    this.edges = this.edges.filter((edge) => {
      if (!edge.includes(node)) return true;
      const line = this.edgeLines.get(edge);
      if (line) {
        line.geometry.dispose();
        (line.material as THREE.Material).dispose();
        this.scene.remove(line);
        this.edgeLines.delete(edge);
      }
      return false;
    });

    if (this.selected === node) this.selected = null;
    if (this.hovered === node) this.hovered = null;
    this.emitCounts();
  }

  private emitCounts() {
    this.onChange(this.nodes.size, this.edges.length);
  }
}
