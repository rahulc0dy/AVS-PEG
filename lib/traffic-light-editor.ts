import { Group, Scene } from "three";
import { MarkingEditor } from "@/lib/marking-editor";
import { Marking } from "@/lib/markings/marking";
import { TrafficLight } from "@/lib/markings/traffic-light";
import { Node } from "@/lib/primitives/node";
import { Edge } from "@/lib/primitives/edge";

export class TrafficLightEditor extends MarkingEditor {
  constructor(
    scene: Scene,
    targetEdges: Edge[],
    markings: Marking[] = [],
    commitGroup?: Group,
  ) {
    super(scene, targetEdges, markings, commitGroup);
  }

  createMarking(position: Node, direction: Node): Marking {
    // Preview is still drawn in the editor group; on commit, base class moves it to commit group.
    return new TrafficLight(position, direction, this.editorGroup);
  }
}
