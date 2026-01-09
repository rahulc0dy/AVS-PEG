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
 * marking variants. The active variant is controlled by {@link setMarkingType}.
 *
 * - Left-click places the current marking type
 * - After placing a source, automatically switches to destination mode
 */
export class SourceDestinationEditor extends MarkingEditor {
  private currentMarkingType: SourceDestinationMarkingType = "source";

  constructor(
    scene: Scene,
    targetEdges: Edge[],
    markings: Marking[],
    commitGroup: Group,
    private onUpdate?: () => void,
    private onMarkingTypeChange?: (type: SourceDestinationMarkingType) => void,
  ) {
    super(scene, targetEdges, markings, commitGroup);
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
   */
  override createMarking(position: Node, direction: Node): Marking {
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
    const willCommit = this.addMarkingOnRelease && this.intent;

    if (willCommit) {
      for (let i = this.markings.length - 1; i >= 0; i--) {
        if (this.markings[i].type === this.currentMarkingType) {
          this.markings[i].dispose();
          this.markings.splice(i, 1);
        }
      }

      if (this.currentMarkingType === "source") {
        this.currentMarkingType = "destination";
        this.onMarkingTypeChange?.("destination");
      }
    }

    super.handleClickRelease(pointer);

    if (willCommit) {
      this.onUpdate?.();
    }
  }
}
