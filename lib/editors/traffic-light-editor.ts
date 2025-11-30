import { Group, Scene } from "three";
import { MarkingEditor } from "@/lib/editors/marking-editor";
import { Marking } from "@/lib/markings/marking";
import { TrafficLight } from "@/lib/markings/traffic-light";
import { Node } from "@/lib/primitives/node";
import { Edge } from "@/lib/primitives/edge";

/**
 * Specialized editor for placing `TrafficLight` markings.
 *
 * Inherits snapping/preview behavior from `MarkingEditor` but constructs
 * `TrafficLight` instances for preview and commit.
 */
export class TrafficLightEditor extends MarkingEditor {
  constructor(
    scene: Scene,
    targetEdges: Edge[],
    markings: Marking[] = [],
    commitGroup?: Group,
  ) {
    super(scene, targetEdges, markings, commitGroup);
  }

  /**
   * Create a `TrafficLight` used for previewing placement. The preview is
   * drawn into the editor's overlay group and reparented on commit.
   */
  createMarking(position: Node, direction: Node): Marking {
    // Preview is still drawn in the editor group; on commit, base class moves it to commit group.
    return new TrafficLight(position, direction, this.editorGroup);
  }
}
