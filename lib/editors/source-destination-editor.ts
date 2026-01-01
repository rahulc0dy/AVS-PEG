import { MarkingEditor } from "@/lib/editors/marking-editor";
import { Marking } from "@/lib/markings/marking";
import { Node } from "@/lib/primitives/node";
import { Destination } from "@/lib/markings/destination";
import { Source } from "@/lib/markings/source";
import { Group, Scene, Vector3 } from "three";
import { Edge } from "@/lib/primitives/edge";

export type SourceDestinationMarkingType = "source" | "destination";

/**
 * Editor for placing "source" and "destination" markings onto edges.
 *
 * This is a specialized {@link MarkingEditor} that can create two different
 * marking variants. The active variant is controlled by {@link setMarkingType}
 * and can also be cycled with {@link handleTabKeyPress}.
 *
 * - Left-click behavior, intent previewing, and commit behavior are inherited
 * from {@link MarkingEditor}.
 * - Pressing Tab clears the current intent preview and toggles between
 * `"source"` and `"destination"`.
 */
export class SourceDestinationEditor extends MarkingEditor {
  private currentMarkingType: SourceDestinationMarkingType = "source";
  private onUpdate: (() => void) | undefined;

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
   * Handle release of a click at the given world position.
   * Overridden to enforce single-instance constraint (delete old source/dest).
   */
  override handleClickRelease(pointer: Vector3): void {
    // Check if we are about to commit a new marking
    const willCommit = this.addMarkingOnRelease && this.intent;

    if (willCommit) {
      // 1. Remove any existing marking of the same type
      // Iterate backwards to safely splice
      for (let i = this.markings.length - 1; i >= 0; i--) {
        if (this.markings[i].type === this.currentMarkingType) {
          // Dispose ThreeJS resources for the old marking
          this.markings[i].dispose();
          // Remove from the array
          this.markings.splice(i, 1);
        }
      }
    }

    // 2. Commit the new marking (Base class adds it to this.markings)
    super.handleClickRelease(pointer);

    // 3. Trigger update callback if a change occurred
    if (willCommit && this.onUpdate) {
      this.onUpdate();
    }
  }

  /**
   * Cycle the active marking type (`"source"` ↔ `"destination"`).
   *
   * Clears any in-progress intent preview so the user sees the new marking type
   * immediately on the next hover.
   */
  override handleTabKeyPress(): void {
    // Cycle through marking types
    if (this.currentMarkingType === "source") {
      this.currentMarkingType = "destination";
    } else {
      this.currentMarkingType = "source";
    }
    this.intent?.dispose();
    this.intent = null;
  }
}
