import { MarkingEditor } from "@/lib/editors/marking-editor";
import { Marking } from "@/lib/markings/marking";
import { Node } from "@/lib/primitives/node";
import { Destination } from "@/lib/markings/destination";
import { Source } from "@/lib/markings/source";
import { Group, Scene, Vector3 } from "three";
import { Edge } from "@/lib/primitives/edge";

export type SourceDestinationMarkingType = "source" | "destination";

/**
 * Callback type for when marking type changes.
 */
export type MarkingTypeChangeCallback = (
  type: SourceDestinationMarkingType,
) => void;

/**
 * Editor for placing "source" and "destination" markings onto edges.
 *
 * This is a specialized {@link MarkingEditor} that can create two different
 * marking variants. The active variant is controlled by {@link setMarkingType}
 * and can be selected via a context menu in the UI.
 *
 * - Left-click places the current marking type
 * - After placing a source, automatically switches to destination mode
 */
export class SourceDestinationEditor extends MarkingEditor {
  private currentMarkingType: SourceDestinationMarkingType = "source";
  private readonly onUpdate: (() => void) | undefined;
  private onMarkingTypeChange?: MarkingTypeChangeCallback;

  constructor(
    scene: Scene,
    targetEdges: Edge[],
    markings: Marking[],
    commitGroup: Group,
    onUpdate?: () => void,
  ) {
    super(scene, targetEdges, markings, commitGroup);
    this.onUpdate = onUpdate;
  }

  /**
   * Set which marking will be created on the next commit.
   * @param type Marking type to create: `"source"` or `"destination"`.
   */
  setMarkingType(type: SourceDestinationMarkingType) {
    this.currentMarkingType = type;
    // Clear intent so the preview updates with the new type
    this.intent?.dispose();
    this.intent = null;
  }

  /**
   * Set a callback to be notified when the marking type changes.
   */
  setOnMarkingTypeChange(callback: MarkingTypeChangeCallback | undefined) {
    this.onMarkingTypeChange = callback;
  }

  /**
   * Create a marking instance for the given position/direction.
   *
   * Note: the returned marking is attached to the editor's temporary group
   * while previewing; the base class moves it to the commit group on commit.
   */
  override createMarking(position: Node, direction: Node): Marking {
    // Preview is still drawn in the editor group; on commit, base class moves it to commit group.
    switch (this.currentMarkingType) {
      case "source":
        return new Source(position, direction, this.editorGroup);
      case "destination":
        return new Destination(position, direction, this.editorGroup);
    }
  }

  /**
   * Override click release to auto-switch to destination after placing a source.
   */
  override handleClickRelease(pointer: Vector3): void {
    // Check if we are about to commit a new marking
    const willCommit = this.addMarkingOnRelease && this.intent;

    if (willCommit) {
      // Remove any existing marking of the same type
      // Iterate backwards to safely splice
      for (let i = this.markings.length - 1; i >= 0; i--) {
        if (this.markings[i].type === this.currentMarkingType) {
          // Dispose ThreeJS resources for the old marking
          this.markings[i].dispose();
          // Remove from the array
          this.markings.splice(i, 1);
        }
      }

      // Switch to destination if placing a source
      if (this.currentMarkingType === "source") {
        this.currentMarkingType = "destination";
        this.onMarkingTypeChange?.("destination");
      }
    }

    // Commit the new marking (Base class adds it to this.markings)
    super.handleClickRelease(pointer);

    // Trigger update callback if a change occurred
    if (willCommit && this.onUpdate) {
      this.onUpdate();
    }
  }
}
