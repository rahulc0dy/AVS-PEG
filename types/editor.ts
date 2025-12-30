import { Vector3 } from "three";

/**
 * The current mode of the editor.
 *
 * - `graph`: edit the road graph (nodes/edges).
 * - `traffic-lights`: place/configure traffic light markings.
 * - `source-destination`: place start/end markings for routing/simulation.
 */
export type EditorMode = "graph" | "traffic-lights" | "source-destination";

/**
 * Generic editor interface for in-scene editing tools.
 *
 * Implementations should show/hide their visuals and manage transient
 * state when enabled/disabled, update any dynamic visuals in `draw()`,
 * and respond to pointer/click events in the scene.
 *
 * Notes:
 * - Pointer/click points are expressed in world coordinates.
 * - Some concrete editors may expose additional helpers (e.g. handling
 *   keyboard shortcuts), but this interface only defines the shared
 *   pointer/click lifecycle.
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
  /** Handle a left-click press at the given world `point`. */
  handleLeftClick(point: Vector3): void;
  /** Handle a right-click press at the given world `point`. */
  handleRightClick(point: Vector3): void;
  /** Handle release of a mouse click at the given world `point`. */
  handleClickRelease(point: Vector3): void;
  /** Handle the Tab key press. */
  handleTabKeyPress(): void;
}
