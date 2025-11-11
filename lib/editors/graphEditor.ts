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
import { LineMaterial } from "three/examples/jsm/Addons.js";

type GraphEvents = {
  onChange?: (nodes: number, edges: number) => void;
};

export class GraphEditor {
  private readonly scene: Scene;
  private readonly camera: Camera;
  private readonly dom: HTMLElement;
  private readonly raycaster = new Raycaster();
  private readonly pointer = new Vector2();

  private readonly nodes = new Map<Node, Mesh>();
  private edges: Edge[] = [];
  private readonly edgeLines = new Map<Edge, Line>();

  private selected: Node | null = null;
  private hovered: Node | null = null;
  private dragging = false;
  private dragOffset = new Vector3();

  constructor(
    params: {
      scene: Scene;
      camera: Camera;
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
      (mesh.material as Material).dispose();
      this.scene.remove(mesh);
    });
    this.edgeLines.forEach((line) => {
      line.geometry.dispose();
      (line.material as Material).dispose();
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

  private getNodeFromMesh(mesh: Mesh): Node | undefined {
    for (const [node, m] of this.nodes) {
      if (m === mesh) return node;
    }
    return undefined;
  }

  private pickNode(): Node | undefined {
    const meshes = [...this.nodes.values()];
    const hit = this.raycaster.intersectObjects(meshes, false)[0];
    if (!hit) return undefined;
    return this.getNodeFromMesh(hit.object as Mesh);
  }

  private handlePointerDown(evt: PointerEvent) {
    this.updatePointer(evt);

    const meshes = [...this.nodes.values()];
    const intersection = this.raycaster.intersectObjects(meshes, false)[0] as
      | Intersection<Mesh>
      | undefined;
    const hitNode = intersection
      ? this.getNodeFromMesh(intersection.object as Mesh)
      : undefined;

    if (evt.button === 2) {
      if (hitNode) this.removeNode(hitNode);
      else this.selected = null;
      return;
    }

    if (evt.button !== 0) return;

    if (intersection && hitNode) {
      if (this.selected && !this.selected.equals(hitNode)) {
        this.addEdge(this.selected, hitNode);
        this.selected = hitNode;
      } else {
        this.selected = hitNode;
      }

      const mesh = this.nodes.get(hitNode)!;
      this.dragOffset.copy(intersection.point).sub(mesh.position);
      this.dragging = true;
      return;
    }

    const plane = new Plane(new Vector3(0, 0, 1), 0);
    const planePoint = new Vector3();
    const ok = this.raycaster.ray.intersectPlane(plane, planePoint);
    if (!ok) return;
    planePoint.z = 0;
    this.addNode(planePoint);
  }

  private handlePointerMove(evt: PointerEvent) {
    this.updatePointer(evt);
    this.hovered = this.pickNode() ?? null;

    if (!this.dragging || !this.selected) return;
    const plane = new Plane(new Vector3(0, 0, 1), 0);
    const newPos = new Vector3();
    const ok = this.raycaster.ray.intersectPlane(plane, newPos);
    if (!ok) return;
    newPos.sub(this.dragOffset);
    newPos.z = 0;
    this.moveNode(this.selected, newPos);
  }

  private handlePointerUp() {
    this.dragging = false;
  }

  private addNode(position: Vector3) {
    const previous = Array.from(this.nodes.keys()).pop();

    const node = new Node(position.x, position.y);
    const mesh = new Mesh(
      new SphereGeometry(2, 16, 16),
      new MeshStandardMaterial({ color: 0x4e9cff })
    );
    mesh.position.set(position.x, position.y, 0);

    this.nodes.set(node, mesh);
    this.scene.add(mesh);

    if (previous) {
      this.addEdge(previous, node);
    }

    this.selected = node;
    this.hovered = node;
    this.emitCounts();
  }

  private moveNode(node: Node, position: Vector3) {
    const mesh = this.nodes.get(node);
    if (!mesh) return;

    node.x = position.x;
    node.y = position.y;
    mesh.position.set(node.x, node.y, 0);

    this.edgeLines.forEach((line, edge) => {
      if (!edge.includes(node)) return;
      const pts = [
        new Vector3(edge.n1.x, edge.n1.y, 0),
        new Vector3(edge.n2.x, edge.n2.y, 0),
      ];
      (line.geometry as BufferGeometry).setFromPoints(pts);
      const posAttr = (line.geometry as BufferGeometry).attributes.position;
      if (posAttr) posAttr.needsUpdate = true;
      line.computeLineDistances();
    });
  }

  private addEdge(n1: Node, n2: Node) {
    const existing = this.edges.find((e) => e.equals(new Edge(n1, n2)));
    if (existing) return;

    const edge = new Edge(n1, n2);
    const geometry = new BufferGeometry().setFromPoints([
      new Vector3(n1.x, n1.y, 0),
      new Vector3(n2.x, n2.y, 0),
    ]);
    const line = new Line(geometry, new LineBasicMaterial({ color: 0xffffff }));
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
      (mesh.material as Material).dispose();
      this.scene.remove(mesh);
      this.nodes.delete(node);
    }

    this.edges = this.edges.filter((edge) => {
      if (!edge.includes(node)) return true;
      const line = this.edgeLines.get(edge);
      if (line) {
        line.geometry.dispose();
        (line.material as Material).dispose();
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
