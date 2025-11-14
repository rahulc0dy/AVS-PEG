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

  scene: Scene;
  graphEditorGroup: Group;

  constructor(graph: Graph, scene: Scene) {
    this.graph = graph;
    this.selectedNode = null;
    this.hoveredNode = null;
    this.dragging = false;

    this.scene = scene;
    this.graphEditorGroup = new Group();
  }

  private selectNode(node: Node) {
    if (this.selectedNode) {
      this.graph.tryAddEdge(new Edge(this.selectedNode, node));
    }
    this.selectedNode = node;
  }

  private hoverNode(node: Node | null) {
    this.hoveredNode = node;
  }

  private removeNode(node: Node) {
    this.graph.removeNode(node);
    this.hoveredNode = null;
    if (this.selectedNode == node) {
      this.selectedNode = null;
    }
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
    }
  }

  handleRightClick(pointer: Vector3) {
    if (this.selectedNode) {
      this.selectedNode = null;
    } else if (this.hoveredNode) {
      this.removeNode(this.hoveredNode);
    }
  }

  handlePointerMove(pointer: Vector3) {
    this.hoverNode(
      getNearestNode(new Node(pointer.x, pointer.z), this.graph.getNodes(), 10)
    );
    if (this.dragging) {
      this.selectedNode = new Node(pointer.x, pointer.z);
    }
  }

  handleClickRelease() {
    this.dragging = false;
  }

  draw() {
    this.graphEditorGroup.clear();

    this.graph.getNodes().forEach((node) => {
      switch (node) {
        case this.hoveredNode:
          node.draw(this.graphEditorGroup, {
            size: 1.2,
            color: new Color(0xcccccc),
          });
          break;
        case this.selectedNode:
          node.draw(this.graphEditorGroup, {
            size: 1,
            color: new Color(0x0000ff),
          });
          break;
        default:
          node.draw(this.graphEditorGroup, {
            size: 1,
            color: new Color(0xffffff),
          });
      }
    });

    this.scene.add(this.graphEditorGroup);
  }
}
