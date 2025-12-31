import { MarkingEditor } from "@/lib/editors/marking-editor";
import { Marking } from "@/lib/markings/marking";
import { Node } from "@/lib/primitives/node";
import { Destination } from "@/lib/markings/destination";
import { Source } from "@/lib/markings/source";
import { Vector3 } from "three";

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
  private onMarkingTypeChange?: MarkingTypeChangeCallback;

  /**
   * Set a callback to be notified when the marking type changes.
   */
  setOnMarkingTypeChange(callback: MarkingTypeChangeCallback | undefined) {
    this.onMarkingTypeChange = callback;
  }

  /**
   * Get the current marking type.
   */
  getMarkingType(): SourceDestinationMarkingType {
    return this.currentMarkingType;
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
    const wasSource = this.currentMarkingType === "source";

    // Call parent implementation to commit the marking
    super.handleClickRelease(pointer);

    // If we just placed a source, switch to destination mode
    if (wasSource && !this.intent) {
      this.currentMarkingType = "destination";
      this.onMarkingTypeChange?.("destination");
    }
  }

  /**
   * Right-click no longer toggles - use context menu in UI instead.
   */
  override handleRightClick(_pointer: Vector3): void {
    // No-op: use context menu from toolbar instead
  }

  /**
   * Tab key press - no longer used.
   */
  override handleTabKeyPress(): void {
    // No-op
  }
}
