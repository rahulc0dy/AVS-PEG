import { Group, Scene } from "three";
import { MarkingEditor } from "@/lib/editors/marking-editor";
import { Marking } from "@/lib/markings/marking";
import { Node } from "@/lib/primitives/node";
import { Edge } from "@/lib/primitives/edge";
import { Destination } from "../markings/destination";
import { Source } from "../markings/source";

export type SourceDestinationMarkingType = "source" | "destination";

/**
 * Editor for placing "source" and "destination" markings onto edges.
 *
 * This is a specialized {@link MarkingEditor} that can create two different
 * marking variants. The active variant is controlled by {@link setMarkingType}
 * and can also be cycled with {@link handleTabKeyPress}.
 *
 * - Left-click behavior, intent previewing, and commit behavior are inherited
 *   from {@link MarkingEditor}.
 * - Pressing Tab clears the current intent preview and toggles between
 *   `"source"` and `"destination"`.
 */
export class SourceDestinationEditor extends MarkingEditor {
  private currentMarkingType: SourceDestinationMarkingType = "source";

  /**
   * Set which marking will be created on the next commit.
   * @param type Marking type to create: `"source"` or `"destination"`.
   */
  setMarkingType(type: SourceDestinationMarkingType) {
    this.currentMarkingType = type;
  }

  /**
   * Create a source/destination editor.
   *
   * @param scene Three.js scene to attach editor visuals.
   * @param targetEdges Road edges eligible for marking placement.
   * @param markings Shared markings array to mutate when committing.
   * @param commitGroup Optional group where committed markings are moved.
   */
  constructor(
    scene: Scene,
    targetEdges: Edge[],
    markings: Marking[],
    commitGroup?: Group,
  ) {
    super(scene, targetEdges, markings, commitGroup);
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
