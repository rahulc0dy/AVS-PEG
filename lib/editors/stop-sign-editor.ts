import { MarkingEditor } from "@/lib/editors/marking-editor";
import { Marking } from "@/lib/markings/marking";
import { StopSign } from "@/lib/markings/stop-sign";
import { Node } from "@/lib/primitives/node";

/**
 * Editor for placing Stop Sign markings.
 *
 * Extends `MarkingEditor` but creates `StopSign` instances
 * instead of generic markings.
 */
export class StopSignEditor extends MarkingEditor {
  /**
   * Create a StopSign marking for preview or placement.
   *
   * The preview is rendered in the editor group, then
   * moved to the commit group when finalized.
   * @param position - World position where the stop sign preview should be created.
   * @param direction - Orientation node used to rotate the stop sign.
   * @returns Preview `StopSign` instance attached to the editor overlay group.
   */
  override createMarking(position: Node, direction: Node): Marking {
    return new StopSign(position, direction, this.editorGroup);
  }
}
