import { Graph } from "@/lib/primitives/graph";
import { Color, Scene, Vector3 } from "three";
import { Edge } from "@/lib/primitives/edge";
import { Node } from "@/lib/primitives/node";
import { getNearestNode } from "@/utils/math";
import { BaseEditor } from "./base-editor";

/**
 * Interactive editor for creating and editing a road `Graph`.
 *
 * Behavior summary:
 * - Left-click a node to select it; selecting two nodes attempts to create an edge.
 * - Left-click empty space to create a new node on click release.
 * - Dragging a selected node updates its coordinates and marks the graph dirty.
 * - Right-click clears selection; if nothing is selected, it deletes the hovered node.
 */
export class GraphEditor extends BaseEditor {
  /** Underlying graph being edited. */
  graph: Graph;
  /** Currently selected node (null when none). */
  selectedNode: Node | null;
  /** Node currently under the pointer (hover). */
  hoveredNode: Node | null;
  /** Whether the editor is currently dragging a selected node. */
  isDragging: boolean;

  /** Callback invoked when drag state changes. */
  private onDragStateChanged: (isDragging: boolean) => void = () => {};

  /** Whether a redraw is required on next `draw()` call. */
  private needsRedraw: boolean;
  /** Last observed graph change counter to avoid redundant redraws. */
  private lastGraphChanges: number;

  /** Internal flag used to create a node on pointer release when set. */
  private addNodeOnRelease: boolean = false;

  /** Colors used for different node states. */
  private static readonly baseColor = new Color(0xffffff);
  private static readonly hoveredColor = new Color(0xfff23b);
  private static readonly selectedColor = new Color(0xff2b59);

  /**
   * Create a new `GraphEditor`.
   * @param graph Graph instance to mutate.
   * @param scene Three.js scene to draw the editor overlay into.
   * @param onDragStateChanged Callback invoked when dragging starts/stops.
   */
  constructor(
    graph: Graph,
    scene: Scene,
    onDragStateChanged: (isDragging: boolean) => void,
  ) {
    super(scene);

    // Initialize state
    this.graph = graph;
    this.selectedNode = null;
    this.hoveredNode = null;
    this.isDragging = false;
    this.onDragStateChanged = onDragStateChanged;

    // Force an initial draw
    this.needsRedraw = true;
    this.lastGraphChanges = -1;
  }

  /**
   * Disable editor visuals and clear transient interaction state.
   */
  disable() {
    super.disable();
    this.selectedNode = null;
    this.hoveredNode = null;
    this.isDragging = false;
  }

  /**
   * Select `node`. If another node was already selected, attempt to create
   * an edge between them.
   * @param node - Node to select
   */
  private selectNode(node: Node) {
    if (this.selectedNode) {
      this.graph.tryAddEdge(new Edge(this.selectedNode, node));
    }
    if (this.selectedNode !== node) {
      this.selectedNode = node;
      this.needsRedraw = true;
    }
  }

  /**
   * Update hover state; causes a redraw when the hovered node changes.
   * @param node - Node being hovered or `null` when none
   */
  private hoverNode(node: Node | null) {
    if (this.hoveredNode !== node) {
      this.hoveredNode = node;
      this.needsRedraw = true;
    }
  }

  /**
   * Remove `node` from the graph and clear selection/hover state if needed.
   * @param node - Node to remove
   */
  private removeNode(node: Node) {
    this.graph.removeNode(node);
    this.hoveredNode = null;
    if (this.selectedNode == node) {
      this.selectedNode = null;
    }
    this.needsRedraw = true;
  }

  /**
   * Handle left mouse (or primary) click. If clicking a hovered node, select
   * it and start dragging. Otherwise mark that a node should be added on
   * pointer release (enables click-to-add behavior).
   * @param _pointer - 3D pointer position (x, z used as node coords)
   */
  override handleLeftClick(_pointer: Vector3) {
    if (this.hoveredNode) {
      this.selectNode(this.hoveredNode);
      this.isDragging = true;
      return;
    }

    this.addNodeOnRelease = true;
  }

  /**
   * Handle right mouse (or secondary) click. Clears selection when present,
   * or removes the hovered node when none is selected.
   * @param _pointer - 3D pointer position
   */
  override handleRightClick(_pointer: Vector3) {
    if (this.selectedNode) {
      this.selectedNode = null;
      this.needsRedraw = true;
    } else if (this.hoveredNode) {
      this.removeNode(this.hoveredNode);
    }
  }

  /**
   * Handle pointer movement: update hovered node and support dragging a
   * selected node (updates node coordinates and marks graph/visuals dirty).
   * @param pointer - 3D pointer position (x, z used as node coords)
   */
  override handlePointerMove(pointer: Vector3) {
    this.hoverNode(
      getNearestNode(new Node(pointer.x, pointer.z), this.graph.getNodes(), 10),
    );
    if (
      this.isDragging &&
      this.selectedNode &&
      (this.selectedNode.x !== pointer.x || this.selectedNode.y !== pointer.z)
    ) {
      // Move the selected node to the pointer position (x,z)
      this.selectedNode.x = pointer.x;
      this.selectedNode.y = pointer.z;

      this.graph.touch();
      this.needsRedraw = true;

      this.onDragStateChanged(true);
    }
    if (!this.isDragging && !this.hoveredNode) {
      // Cancel pending add-on-release if pointer moved away
      this.addNodeOnRelease = false;
    }
  }

  /**
   * Handle pointer release events: finish dragging and optionally add a new
   * node at the release position when `addNodeOnRelease` is set.
   * @param pointer - 3D pointer position
   */
  override handleClickRelease(pointer: Vector3) {
    this.isDragging = false;
    this.onDragStateChanged(false);
    if (this.addNodeOnRelease) {
      const node = new Node(pointer.x, pointer.z);
      const isAdded = this.graph.tryAddNode(node);
      if (isAdded) {
        this.selectNode(node);
        this.hoverNode(node);
        this.needsRedraw = true;
      }
      this.addNodeOnRelease = false;
    }
  }

  override handleTabKeyPress(): void {}

  /**
   * Draw editor visuals (nodes) into the scene. Uses `needsRedraw` and the
   * graph's change counter to avoid unnecessary work.
   * @returns `true` when a redraw was performed, `false` when skipped
   */
  override draw(): boolean {
    const currentChanges = this.graph.getChanges();
    if (!this.needsRedraw && currentChanges === this.lastGraphChanges) {
      return false;
    }
    this.editorGroup.clear();

    this.graph.getNodes().forEach((node) => {
      switch (node) {
        case this.hoveredNode:
          node.draw(this.editorGroup, {
            size: 1.2,
            color: GraphEditor.hoveredColor,
          });
          break;
        case this.selectedNode:
          node.draw(this.editorGroup, {
            size: 1,
            color: GraphEditor.selectedColor,
          });
          break;

        default:
          node.draw(this.editorGroup, {
            size: 1,
            color: GraphEditor.baseColor,
          });
      }
    });

    this.scene.add(this.editorGroup);
    this.lastGraphChanges = currentChanges;
    this.needsRedraw = false;
    return true;
  }
}
