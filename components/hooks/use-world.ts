import { World, WorldConfig } from "@/lib/world";
import { useEffect, useRef } from "react";
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
 * @returns A ref to the World instance
 *
 * @example
 * ```tsx
 * const worldRef = useWorld(scene, {
 *   worldConfig: { initialCars: [] },
 *   showGrid: true,
 * });
 * ```
 */
export function useWorld(
  scene: Scene,
  options?: UseWorldOptions,
): React.RefObject<World | null> {
  const worldRef = useRef<World | null>(null);
  const gridRef = useRef<GridHelper | null>(null);

  const {
    worldConfig,
    showGrid = true,
    gridSize = 1000,
    gridDivisions = 40,
  } = options ?? {};

  useEffect(() => {
    // Create the World instance
    const world = new World(scene, worldConfig);
    worldRef.current = world;

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
    };
  }, [scene, worldConfig, showGrid, gridSize, gridDivisions]);

  return worldRef;
}
