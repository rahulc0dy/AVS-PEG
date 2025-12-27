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
  trafficLightGraph: Graph;
  selectedTrafficLight: Node | null;
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

  private hoverTrafficLight(trafficLight: Node | null) {
    if (this.hoveredTrafficLight !== trafficLight) {
      this.hoveredTrafficLight = trafficLight;
      this.needsRedraw = true;
    }
  }

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

  override handleLeftClick(pointer: Vector3) {
    if (this.hoveredTrafficLight) {
      this.selectTrafficLight(this.hoveredTrafficLight);
      this.addMarkingOnRelease = false;
      return;
    }

    super.handleLeftClick(pointer);
  }

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
