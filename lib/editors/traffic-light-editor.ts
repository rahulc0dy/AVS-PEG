import { Color, Group, Scene, Vector3 } from "three";
import { MarkingEditor } from "@/lib/editors/marking-editor";
import { Marking } from "@/lib/markings/marking";
import { TrafficLight } from "@/lib/markings/traffic-light";
import { Node } from "@/lib/primitives/node";
import { Edge } from "@/lib/primitives/edge";
import { Graph } from "@/lib/primitives/graph";
import { getNearestNode } from "@/utils/math";

/**
 * Specialized editor for placing `TrafficLight` markings.
 *
 * Inherits snapping/preview behavior from `MarkingEditor` but constructs
 * `TrafficLight` instances for preview and commit.
 */
export class TrafficLightEditor extends MarkingEditor {
  /** Graph storing traffic light nodes and connecting edges (phase groups). */
  trafficLightGraph: Graph;
  /** Currently selected traffic light node (used to create edges). */
  selectedTrafficLight: Node | null;
  /** Traffic light node currently under the pointer (hover). */
  hoveredTrafficLight: Node | null;

  /** Whether a redraw is required on next `draw()` call. */
  private needsRedraw: boolean;
  /** Last observed graph change counter to skip redundant draws. */
  private lastGraphChanges: number;

  /** Colors + thresholds for visual feedback. */
  private static readonly baseColor = new Color(0xffffff);
  private static readonly hoveredColor = new Color(0xfff23b);
  private static readonly selectedColor = new Color(0xff2b59);
  private static readonly edgeColor = new Color(0x6cf0ff);
  private static readonly hoverThreshold = 10;

  /**
   * Create a new `TrafficLightEditor`.
   * @param scene Three.js scene to draw the editor overlay into.
   * @param targetEdges Road edges that are valid snap targets for placing traffic lights.
   * @param markings Array to receive committed `TrafficLight` markings.
   * @param trafficLightGraph Graph storing traffic-light nodes and their linking edges.
   * @param commitGroup Optional parent group for committed markings.
   */
  constructor(
    scene: Scene,
    targetEdges: Edge[],
    markings: Marking[],
    trafficLightGraph: Graph,
    commitGroup?: Group,
  ) {
    super(scene, targetEdges, markings, commitGroup);
    this.trafficLightGraph = trafficLightGraph;
    this.selectedTrafficLight = null;
    this.hoveredTrafficLight = null;

    this.needsRedraw = true;
    this.lastGraphChanges = -1;
  }

  /**
   * Select a traffic light node.
   *
   * If a previous node was selected, the editor attempts to connect them
   * by adding an edge in `trafficLightGraph`.
   * @param trafficLight Node to select.
   */
  private selectTrafficLight(trafficLight: Node | null) {
    if (!trafficLight) return;

    const previousSelection = this.selectedTrafficLight;
    let edgeCreated = false;
    if (previousSelection) {
      edgeCreated = this.trafficLightGraph.tryAddEdge(
        new Edge(previousSelection, trafficLight),
      );
    }

    if (edgeCreated) {
      this.trafficLightGraph.completeDisconnectedComponents();
    }

    if (previousSelection === trafficLight) return;

    this.selectedTrafficLight = trafficLight;
    this.needsRedraw = true;
  }

  /**
   * Update which traffic light node is considered hovered.
   * @param trafficLight Hovered node, or `null` when none.
   */
  private hoverTrafficLight(trafficLight: Node | null) {
    if (this.hoveredTrafficLight !== trafficLight) {
      this.hoveredTrafficLight = trafficLight;
      this.needsRedraw = true;
    }
  }

  /**
   * Remove a traffic light node and its associated marking (if present).
   * @param node Traffic light node to remove.
   */
  private removeTrafficLight(node: Node) {
    const index = this.markings.findIndex(
      (marking): marking is TrafficLight =>
        marking instanceof TrafficLight && marking.position === node,
    );
    if (index !== -1) {
      const [marking] = this.markings.splice(index, 1);
      marking.dispose();
    }

    this.trafficLightGraph.removeNode(node);
    this.trafficLightGraph.completeDisconnectedComponents();
    if (this.hoveredTrafficLight === node) {
      this.hoverTrafficLight(null);
    }
    if (this.selectedTrafficLight === node) {
      this.selectedTrafficLight = null;
    }
    this.addMarkingOnRelease = false;
    this.needsRedraw = true;
  }

  /**
   * Create a `TrafficLight` used for previewing placement. The preview is
   * drawn into the editor's overlay group and reparented on commit.
   */
  override createMarking(position: Node, direction: Node): Marking {
    // Preview is still drawn in the editor group; on commit, base class moves it to commit group.
    return new TrafficLight(position, direction, this.editorGroup);
  }

  /**
   * Track pointer movement: updates the base placement preview and updates which
   * traffic light node is hovered for selection/edge creation.
   */
  override handlePointerMove(pointer: Vector3) {
    super.handlePointerMove(pointer);
    this.hoverTrafficLight(
      getNearestNode(
        new Node(pointer.x, pointer.z),
        this.trafficLightGraph.getNodes(),
        TrafficLightEditor.hoverThreshold,
      ),
    );
  }

  /**
   * Handle left-click:
   * - if hovering an existing traffic light, select it
   * - otherwise delegate to the base `MarkingEditor` for placement
   */
  override handleLeftClick(pointer: Vector3) {
    if (this.hoveredTrafficLight) {
      this.selectTrafficLight(this.hoveredTrafficLight);
      this.addMarkingOnRelease = false;
      return;
    }

    super.handleLeftClick(pointer);
  }

  /**
   * Handle right-click:
   * - clears current selection, otherwise
   * - deletes the hovered traffic light node/marking.
   */
  override handleRightClick(_pointer: Vector3) {
    if (this.selectedTrafficLight) {
      this.selectedTrafficLight = null;
      this.needsRedraw = true;
      return;
    }
    if (this.hoveredTrafficLight) {
      this.removeTrafficLight(this.hoveredTrafficLight);
    }
  }

  /**
   * Commit placement on click release (when `MarkingEditor` indicates a commit).
   * Also syncs the traffic light graph and updates selection/hover state.
   */
  override handleClickRelease(pointer: Vector3) {
    const intentTrafficLight = this.intent as TrafficLight | null;
    if (this.addMarkingOnRelease && intentTrafficLight) {
      const addedNode = intentTrafficLight.position;
      const isAdded = this.trafficLightGraph.tryAddNode(addedNode);
      if (isAdded) {
        this.trafficLightGraph.completeDisconnectedComponents();
      }
      this.selectTrafficLight(addedNode);
      this.hoverTrafficLight(addedNode);
      this.needsRedraw = true;
    }

    super.handleClickRelease(pointer);
  }

  /**
   * Draw the traffic light graph (nodes/edges) and then the placement preview.
   * @returns `true` when either the graph or preview changed and needs a re-render.
   */
  override draw(): boolean {
    let redrewGraph = false;
    const currentChanges = this.trafficLightGraph.getChanges();
    if (this.needsRedraw || currentChanges !== this.lastGraphChanges) {
      this.editorGroup.clear();

      this.trafficLightGraph.getEdges().forEach((edge) => {
        edge.draw(this.editorGroup, {
          width: 2,
          color: TrafficLightEditor.edgeColor,
        });
      });

      this.trafficLightGraph.getNodes().forEach((node) => {
        if (node === this.hoveredTrafficLight) {
          node.draw(this.editorGroup, {
            size: 1.2,
            color: TrafficLightEditor.hoveredColor,
          });
          return;
        }

        if (node === this.selectedTrafficLight) {
          node.draw(this.editorGroup, {
            size: 1,
            color: TrafficLightEditor.selectedColor,
          });
          return;
        }

        node.draw(this.editorGroup, {
          size: 1,
          color: TrafficLightEditor.baseColor,
        });
      });

      this.scene.add(this.editorGroup);
      this.lastGraphChanges = currentChanges;
      this.needsRedraw = false;
      redrewGraph = true;
    }

    const previewChanged = super.draw();
    return redrewGraph || previewChanged;
  }
}
