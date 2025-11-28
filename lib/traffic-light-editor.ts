import { Scene } from "three";
import { MarkingEditor } from "@/lib/marking-editor";
import { Marking } from "@/lib/markings/marking";
import { TrafficLight } from "@/lib/markings/traffic-light";
import { Node } from "@/lib/primitives/node";
import { Edge } from "@/lib/primitives/edge";

export class TrafficLightEditor extends MarkingEditor {
  constructor(scene: Scene, targetEdges: Edge[], markings: Marking[] = []) {
    super(scene, targetEdges, markings);
  }

  createMarking(position: Node, direction: Node): Marking {
    return new TrafficLight(position, direction, this.editorGroup);
  }
}
