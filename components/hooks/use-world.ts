import { World, WorldConfig } from "@/lib/world/world";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { Color, Scene } from "three";
import { InfiniteGridHelper } from "@/utils/infinite-grid-helper";

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
  const gridRef = useRef<InfiniteGridHelper | null>(null);
  const subscribersRef = useRef<Set<() => void>>(new Set());

  const { worldConfig, showGrid = true } = options ?? {};

  // Use useSyncExternalStore to avoid setState in effect
  const world = useSyncExternalStore(
    (callback) => {
      subscribersRef.current.add(callback);
      return () => subscribersRef.current.delete(callback);
    },
    () => worldRef.current,
    () => null,
  );

  useEffect(() => {
    // Create the World instance
    worldRef.current = new World(scene, worldConfig);
    // Notify subscribers that world has changed
    subscribersRef.current.forEach((cb) => cb());

    // Add grid helper if enabled
    if (showGrid) {
      const grid = new InfiniteGridHelper(10, 100, new Color(0x666666), 8000);
      grid.position.set(0, 0, 0);
      scene.add(grid);
      gridRef.current = grid;
    }

    // Cleanup
    const currentSubscribers = subscribersRef.current;
    return () => {
      if (worldRef.current) {
        worldRef.current.dispose();
        worldRef.current = null;
      }
      if (gridRef.current) {
        scene.remove(gridRef.current);
        if (gridRef.current.geometry) {
          gridRef.current.geometry.dispose();
        }
        if (gridRef.current.material) {
          if (Array.isArray(gridRef.current.material)) {
            gridRef.current.material.forEach((mat) => mat.dispose());
          } else {
            gridRef.current.material.dispose();
          }
        }
        gridRef.current = null;
      }
      currentSubscribers.forEach((cb) => cb());
    };
  }, [scene, worldConfig, showGrid]);

  return { worldRef, world };
}
