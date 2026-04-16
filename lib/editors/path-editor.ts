import { BaseEditor } from "@/lib/editors/base-editor";
import { Scene, Vector3 } from "three";
import { Path } from "@/lib/markings/path";
import { Node } from "../primitives/node";

export class PathEditor extends BaseEditor {
  targetNodes: Node[];
  paths: Path[];
  selectedPathIdx: number;

  constructor(scene: Scene, targetNodes: Node[], paths: Path[]) {
    super(scene);

    this.targetNodes = targetNodes;
    this.paths = paths;
    this.selectedPathIdx = this.paths.length > 0 ? 0 : -1; // Select the first path if available.
  }

  override draw(): boolean {
    return false;
  }

  override handleClickRelease(pointer: Vector3): void {}

  override handleLeftClick(pointer: Vector3): void {
    // Check if the pointer click location is on a node, if so,
    // select it and draw some visual to indicate selection.
    // Also add this node to the current path being created/edited.
  }

  override handlePointerMove(pointer: Vector3): void {
    // Check if the pointer hover location is on a node draw some hover visual.
  }

  override handleRightClick(pointer: Vector3): void {
    // Use right click to remove the node from the current path being created/edited.
  }
}
