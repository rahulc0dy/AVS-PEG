import { Group, Scene } from "three";
import { MarkingEditor } from "./marking-editor";
import { Marking } from "./markings/marking";
import { TrafficLight } from "./markings/traffic-light";
import { Node } from "./primitives/node";
import { Edge } from "./primitives/edge";

export class TrafficLightEditor extends MarkingEditor {
  constructor(scene: Scene, targetEdges: Edge[], markings: Marking[] = []) {
    super(scene, targetEdges, markings);
  }

  createMarking(position: Node, direction: Node): Marking {
    return new TrafficLight(position, direction, this.editorGroup);
  }
}
