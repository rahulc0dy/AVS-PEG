import { Group, Scene, Vector3 } from "three";
import { BaseEditor } from "./editors/base-editor";
import { Marking } from "./markings/marking";
import { Edge } from "./primitives/edge";
import { Node } from "./primitives/node";
import { getNearestEdge } from "@/utils/math";

export class MarkingEditor extends BaseEditor {
  intent: Marking | null;
  targetEdges: Edge[];
  markings: Marking[];

  private addMarkingOnRelease: boolean = false;

  constructor(scene: Scene, targetEdges: Edge[], markings: Marking[] = []) {
    super(scene);

    this.intent = null;
    this.targetEdges = targetEdges;
    this.markings = markings;
  }

  createMarking(position: Node, direction: Node): Marking {
    return new Marking(position, direction, new Group());
  }

  handlePointerMove(pointer: Vector3): void {
    const pointerNode = new Node(pointer.x, pointer.z);
    const nearestEdge = getNearestEdge(pointerNode, this.targetEdges, 20);
    if (nearestEdge) {
      const projected = nearestEdge.projectNode(pointerNode);
      if (projected.offset >= 0 && projected.offset <= 1) {
        const direction = nearestEdge.directionVector();
        if (this.intent) {
          this.intent.position = projected.point;
          this.intent.direction = direction;
        } else {
          this.intent = this.createMarking(projected.point, direction);
        }
      } else {
        // pointer moved outside valid range — dispose previous intent (if any)
        this.intent?.dispose();
        this.intent = null;
      }
    } else {
      // no nearest edge — dispose previous intent (if any)
      this.intent?.dispose();
      this.intent = null;
    }
  }

  handleLeftClick(_pointer: Vector3): void {
    if (this.intent) {
      this.addMarkingOnRelease = true;
    }
  }

  handleRightClick(_pointer: Vector3): void {
    throw new Error("Method not implemented.");
  }

  handleClickRelease(_pointer: Vector3): void {
    if (this.addMarkingOnRelease && this.intent) {
      this.markings.push(this.intent);
      this.intent.update();
      this.intent = null;
      this.addMarkingOnRelease = false;
    }
    console.log(this.markings);
  }

  draw(): boolean {
    if (this.intent) {
      this.intent.draw(this.editorGroup, this.intent.modelUrl);
      return true;
    }
    return false;
  }
}
