import { Group, Scene, Vector3 } from "three";
import { BaseEditor } from "@/lib/editors/base-editor";
import { Marking } from "@/lib/markings/marking";
import { Edge } from "@/lib/primitives/edge";
import { Node } from "@/lib/primitives/node";
import { getNearestEdge } from "@/utils/math";

export class MarkingEditor extends BaseEditor {
  intent: Marking | null;
  targetEdges: Edge[];
  markings: Marking[];
  /** Group where committed markings should be added (typically World.worldGroup). */
  commitGroup: Group;

  private addMarkingOnRelease: boolean = false;

  constructor(
    scene: Scene,
    targetEdges: Edge[],
    markings: Marking[] = [],
    commitGroup?: Group,
  ) {
    super(scene);

    this.intent = null;
    this.targetEdges = targetEdges;
    this.markings = markings;
    // Default commit group to the editor group if not provided (backward compat),
    // but ideally the World.worldGroup should be passed in.
    this.commitGroup = commitGroup ?? this.editorGroup;
  }

  createMarking(position: Node, direction: Node): Marking {
    // Use editorGroup for preview by default; we'll switch to commitGroup on commit.
    return new Marking(position, direction, this.editorGroup);
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
      // Reparent preview objects from the editor overlay to the world group
      // (Do NOT dispose here; disposing would destroy meshes/lights like the
      // traffic light glow. Adding to a new parent will auto-reparent in Three.js.)
      this.intent.group = this.commitGroup;
      this.markings.push(this.intent);
      this.intent = null;
      this.addMarkingOnRelease = false;
    }
  }

  draw(): boolean {
    if (this.intent) {
      this.intent.draw(this.editorGroup, this.intent.modelUrl);
      return true;
    }
    return false;
  }
}
