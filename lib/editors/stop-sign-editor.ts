import { Group, Scene, Vector3 } from "three";
import { MarkingEditor } from "@/lib/editors/marking-editor";
import { Marking } from "@/lib/markings/marking";
import { StopSign } from "@/lib/markings/stop-sign";
import { Node } from "@/lib/primitives/node";
import { Edge } from "@/lib/primitives/edge";

/**
 * Editor for placing Stop Sign markings.
 *
 * Extends `MarkingEditor` but creates `StopSign` instances
 * instead of generic markings.
 */
export class StopSignEditor extends MarkingEditor {
  /**
   * Create a new StopSignEditor.
   *
   * @param scene Three.js scene used for drawing editor overlays
   * @param targetEdges Edges that stop signs can snap to
   * @param markings Global markings array where committed stop signs are stored
   * @param commitGroup Optional group where committed markings are placed
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
   * Create a StopSign marking for preview or placement.
   *
   * The preview is rendered in the editor group, then
   * moved to the commit group when finalized.
   */
  override createMarking(position: Node, direction: Node): Marking {
    return new StopSign(position, direction, this.editorGroup);
  }

  /**
   * Draw preview + editor overlay.
   */
  override draw(): boolean {
    return super.draw();
  }
}
