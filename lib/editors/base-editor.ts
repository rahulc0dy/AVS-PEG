import { Scene, Group, Vector3 } from "three";
import { Editor } from "@/types/editor";

/**
 * Provides common functionality for in-scene editors: a dedicated
 * Three.js `Group` for editor visuals, visibility toggling, and
 * lifecycle management. Concrete editors should extend this class and
 * implement the abstract drawing and input-handling methods.
 */
export abstract class BaseEditor implements Editor {
  /** The Three.js scene where the editor's visuals will be attached. */
  scene: Scene;
  /** The Three.js group containing all visuals for this editor. */
  editorGroup: Group;

  /**
   * Create a new BaseEditor.
   * @param scene The Three.js scene where the editor visuals will be added.
   */
  constructor(scene: Scene) {
    this.scene = scene;
    this.editorGroup = new Group();
    this.editorGroup.visible = false; // Start disabled
    this.scene.add(this.editorGroup);
  }

  /**
   * Enable the editor: show visuals and allow interaction.
   */
  enable() {
    this.editorGroup.visible = true;
  }

  /**
   * Disable the editor: hide visuals and stop interaction.
   */
  disable() {
    this.editorGroup.visible = false;
  }

  /**
   * Dispose the editor and remove its visuals from the scene.
   * Subclasses should also dispose of any geometries/materials they own.
   */
  dispose() {
    this.scene.remove(this.editorGroup);
  }

  /**
   * Handle pointer movement in world coordinates.
   * @param pointer World position of the pointer as a `Vector3`.
   */
  abstract handlePointerMove(pointer: Vector3): void;

  /**
   * Handle left-click events at the given world position.
   * @param pointer World position of the click as a `Vector3`.
   */
  abstract handleLeftClick(pointer: Vector3): void;

  /**
   * Handle right-click events at the given world position.
   * @param pointer World position of the click as a `Vector3`.
   */
  abstract handleRightClick(pointer: Vector3): void;

  /**
   * Handle release of a click at the given world position.
   * @param pointer World position of the release as a `Vector3`.
   */
  abstract handleClickRelease(pointer: Vector3): void;

  /**
   * Update editor visuals. Return `true` if the scene requires a re-render.
   */
  abstract draw(): boolean;
}
