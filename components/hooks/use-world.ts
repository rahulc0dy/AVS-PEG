import { World, WorldConfig } from "@/lib/world";
import { useEffect, useRef, useState } from "react";
import { GridHelper, Scene } from "three";

/**
 * Options for the useWorld hook.
 */
export interface UseWorldOptions {
  /** Configuration for World initialization */
  worldConfig?: WorldConfig;
  /** Whether to show the grid helper (default: true) */
  showGrid?: boolean;
  /** Grid size (default: 1000) */
  gridSize?: number;
  /** Grid divisions (default: 40) */
  gridDivisions?: number;
}

/**
 * Return type for the useWorld hook.
 */
export interface UseWorldResult {
  /** Ref to the World instance */
  worldRef: React.RefObject<World | null>;
  /** The World instance (null until initialized, triggers re-render when ready) */
  world: World | null;
}

/**
 * Base hook that initializes a World instance and optional GridHelper.
 *
 * This hook strictly handles:
 * - Creating the World instance
 * - Adding a grid helper to the scene
 * - Cleanup on unmount
 *
 * It does NOT initialize any editors. Use `useWorldEditors` for editor functionality.
 *
 * @param scene - Three.js scene to attach the world and grid to
 * @param options - Optional configuration for world and grid
 * @returns Object containing both the ref and a state value for the World instance
 *
 * @example
 * ```tsx
 * const { worldRef, world } = useWorld(scene, {
 *   worldConfig: { initialCars: [] },
 *   showGrid: true,
 * });
 * // Use `world` to trigger dependent effects when world is ready
 * // Use `worldRef` for accessing current value in event handlers
 * ```
 */
export function useWorld(
  scene: Scene,
  options?: UseWorldOptions,
): UseWorldResult {
  const worldRef = useRef<World | null>(null);
  const gridRef = useRef<GridHelper | null>(null);
  const [world, setWorld] = useState<World | null>(null);

  const {
    worldConfig,
    showGrid = true,
    gridSize = 1000,
    gridDivisions = 40,
  } = options ?? {};

  useEffect(() => {
    // Create the World instance
    const newWorld = new World(scene, worldConfig);
    worldRef.current = newWorld;
    setWorld(newWorld); // Trigger re-render for dependent hooks

    // Add grid helper if enabled
    if (showGrid) {
      const grid = new GridHelper(gridSize, gridDivisions, 0x666666, 0x333333);
      grid.position.set(0, 0, 0);
      scene.add(grid);
      gridRef.current = grid;
    }

    // Cleanup
    return () => {
      if (worldRef.current) {
        worldRef.current.dispose();
        worldRef.current = null;
      }
      if (gridRef.current) {
        scene.remove(gridRef.current);
        gridRef.current.dispose();
        gridRef.current = null;
      }
      setWorld(null);
    };
  }, [scene, worldConfig, showGrid, gridSize, gridDivisions]);

  return { worldRef, world };
}
