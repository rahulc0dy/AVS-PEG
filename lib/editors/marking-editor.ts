import { Group, Scene, Vector3 } from "three";
import { BaseEditor } from "@/lib/editors/base-editor";
import { Marking } from "@/lib/markings/marking";
import { Edge } from "@/lib/primitives/edge";
import { Node } from "@/lib/primitives/node";
import { getNearestEdge } from "@/utils/math";

/**
 * Editor for placing and previewing markings in the world.
 *
 * The editor maintains a transient `intent` marking used for previewing
 * placement while the user moves the pointer. On commit the preview is
 * reparented into `commitGroup` and added to `markings`.
 */
export class MarkingEditor extends BaseEditor {
  /** Preview marking currently following the pointer, or `null`. */
  intent: Marking | null;
  /** Edges that are valid targets for marking placement. */
  targetEdges: Edge[];
  /** Array storing committed markings managed by the caller. */
  markings: Marking[];
  /** Group where committed markings should be added (typically World.worldGroup). */
  commitGroup: Group;

  /** Internal flag indicating a pending commit on click release. */
  private addMarkingOnRelease: boolean = false;

  /**
   * Create a new MarkingEditor.
   * @param scene Three.js scene to attach editor visuals to.
   * @param targetEdges Edges considered valid for placement (used for snapping).
   * @param markings Optional array to collect committed markings.
   * @param commitGroup Optional group to parent committed markings into.
   */
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

  /**
   * Create a new marking instance used for preview. Subclasses may override
   * to construct specific marking types (e.g. `TrafficLight`).
   */
  createMarking(position: Node, direction: Node): Marking {
    // Use editorGroup for preview by default; we'll switch to commitGroup on commit.
    return new Marking(position, direction, this.editorGroup);
  }

  /**
   * Track pointer movement and update the preview `intent` when the pointer
   * is near a valid target edge.
   */
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

  /** On left click, prepare to commit the preview on release. */
  handleLeftClick(_pointer: Vector3): void {
    if (this.intent) {
      this.addMarkingOnRelease = true;
    }
  }

  /** Right-click behavior is intentionally unimplemented for now. */
  handleRightClick(_pointer: Vector3): void {
    throw new Error("Method not implemented.");
  }

  /**
   * Commit the preview marking to the `commitGroup` when the click is released.
   * The preview is reparented (not disposed) so meshes/lights remain intact.
   */
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

  /** Draw the preview marking into the editor overlay. Returns `true` when visuals changed. */
  draw(): boolean {
    if (this.intent) {
      this.intent.draw(this.editorGroup, this.intent.modelUrl);
      return true;
    }
    return false;
  }
}
