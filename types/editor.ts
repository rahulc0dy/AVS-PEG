import { Vector3 } from "three";

export type EditorMode = "graph" | "stop" | "traffic-lights" | "crossing";

export interface Editor {
  /** Enable the editor (show visuals, reset state). */
  enable(): void;

  /** Disable the editor (hide visuals, clear selection). */
  disable(): void;

  /**
   * Update visuals.
   * @returns true if the scene needs to be re-rendered.
   */
  draw(): boolean;

  // Event handlers
  handlePointerMove(point: Vector3): void;
  handleLeftClick(point: Vector3): void;
  handleRightClick(point: Vector3): void;
  handleClickRelease(point: Vector3): void;
}
