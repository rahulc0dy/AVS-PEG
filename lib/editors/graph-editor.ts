import { Graph } from "@/lib/primitives/graph";
import { Color, Group, Scene, Vector3 } from "three";
import { Edge } from "@/lib/primitives/edge";
import { Node } from "@/lib/primitives/node";
import { getNearestNode } from "@/utils/math";

export class GraphEditor {
  graph: Graph;
  selectedNode: Node | null;
  hoveredNode: Node | null;
  dragging: boolean;

  private onDragStateChanged: (isDragging: boolean) => void = () => {};

  scene: Scene;
  graphEditorGroup: Group;
  private needsRedraw: boolean;
  private lastGraphChanges: number;

  private static readonly baseColor = new Color(0xffffff);
  private static readonly hoveredColor = new Color(0xcccccc);
  private static readonly selectedColor = new Color(0x0000ff);

  constructor(
    graph: Graph,
    scene: Scene,
    onDragStateChanged: (isDragging: boolean) => void
  ) {
    this.graph = graph;
    this.selectedNode = null;
    this.hoveredNode = null;
    this.dragging = false;
    this.onDragStateChanged = onDragStateChanged;

    this.scene = scene;
    this.graphEditorGroup = new Group();
    this.scene.add(this.graphEditorGroup);

    this.needsRedraw = true;
    this.lastGraphChanges = -1;
  }

  private selectNode(node: Node) {
    if (this.selectedNode) {
      this.graph.tryAddEdge(new Edge(this.selectedNode, node));
    }
    if (this.selectedNode !== node) {
      this.selectedNode = node;
      this.needsRedraw = true;
    }
  }

  private hoverNode(node: Node | null) {
    if (this.hoveredNode !== node) {
      this.hoveredNode = node;
      this.needsRedraw = true;
    }
  }

  private removeNode(node: Node) {
    this.graph.removeNode(node);
    this.hoveredNode = null;
    if (this.selectedNode == node) {
      this.selectedNode = null;
    }
    this.needsRedraw = true;
  }

  handleLeftClick(pointer: Vector3) {
    if (this.hoveredNode) {
      this.selectNode(this.hoveredNode);
      this.dragging = true;
      return;
    }
    const node = this.graph.tryAddNode(new Node(pointer.x, pointer.z));
    if (node) {
      this.selectNode(node);
      this.hoverNode(node);
      this.needsRedraw = true;
    }
  }

  handleRightClick(pointer: Vector3) {
    if (this.selectedNode) {
      this.selectedNode = null;
      this.needsRedraw = true;
    } else if (this.hoveredNode) {
      this.removeNode(this.hoveredNode);
    }
  }

  handlePointerMove(pointer: Vector3) {
    this.hoverNode(
      getNearestNode(new Node(pointer.x, pointer.z), this.graph.getNodes(), 10)
    );
    if (
      this.dragging &&
      this.selectedNode &&
      (this.selectedNode.x !== pointer.x || this.selectedNode.y !== pointer.z)
    ) {
      this.selectedNode.x = pointer.x;
      this.selectedNode.y = pointer.z;

      this.graph.touch();
      this.needsRedraw = true;

      this.onDragStateChanged(true);
    }
  }

  handleClickRelease() {
    this.dragging = false;
    this.onDragStateChanged(false);
  }

  draw() {
    const currentChanges = this.graph.getChanges();
    if (!this.needsRedraw && currentChanges === this.lastGraphChanges) {
      return false;
    }
    this.graphEditorGroup.clear();

    this.graph.getNodes().forEach((node) => {
      switch (node) {
        case this.hoveredNode:
          node.draw(this.graphEditorGroup, {
            size: 1.2,
            color: GraphEditor.hoveredColor,
          });
          break;
        case this.selectedNode:
          node.draw(this.graphEditorGroup, {
            size: 1,
            color: GraphEditor.selectedColor,
          });
          break;
        default:
          node.draw(this.graphEditorGroup, {
            size: 1,
            color: GraphEditor.baseColor,
          });
      }
    });

    this.scene.add(this.graphEditorGroup);
    this.lastGraphChanges = currentChanges;
    this.needsRedraw = false;
    return true;
  }
}
