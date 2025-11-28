import { Scene, Group, Vector3 } from "three";
import { Editor } from "@/types/editor";

export abstract class BaseEditor implements Editor {
  scene: Scene;
  /** The Three.js group containing all visuals for this editor. */
  editorGroup: Group;

  constructor(scene: Scene) {
    this.scene = scene;
    this.editorGroup = new Group();
    this.editorGroup.visible = false; // Start disabled
    this.scene.add(this.editorGroup);
  }

  enable() {
    this.editorGroup.visible = true;
  }

  disable() {
    this.editorGroup.visible = false;
  }

  dispose() {
    this.scene.remove(this.editorGroup);
  }

  abstract draw(): boolean;
  abstract handlePointerMove(pointer: Vector3): void;
  abstract handleLeftClick(pointer: Vector3): void;
  abstract handleRightClick(pointer: Vector3): void;
  abstract handleClickRelease(pointer: Vector3): void;
}
