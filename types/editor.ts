import { Vector3 } from "three";

/**
 * The current mode of the editor.
 *
 * - `graph`: editing the road graph (nodes/edges)
 * - `traffic-lights`: editing traffic light placement and configuration
 */
export type EditorMode = "graph" | "traffic-lights";

/**
 * Generic editor interface for in-scene editing tools.
 *
 * Implementations should show/hide their visuals and manage transient
 * state when enabled/disabled, update any dynamic visuals in `draw()`,
 * and respond to pointer/click events in the scene.
 */
export interface Editor {
  /**
   * Enable the editor: show visuals, reset or initialize state.
   */
  enable(): void;

  /**
   * Disable the editor: hide visuals and clear any selection/state.
   */
  disable(): void;

  /**
   * Update editor visuals.
   *
   * Called during the render/update loop. Return `true` when the scene
   * requires a re-render (e.g. visuals changed), otherwise return `false`.
   */
  draw(): boolean;

  // Event handlers
  /** Handle pointer movement in world coordinates (`Vector3`). */
  handlePointerMove(point: Vector3): void;
  /** Handle a left-click at the given world `point`. */
  handleLeftClick(point: Vector3): void;
  /** Handle a right-click at the given world `point`. */
  handleRightClick(point: Vector3): void;
  /** Handle release of a click at the given world `point`. */
  handleClickRelease(point: Vector3): void;
}
