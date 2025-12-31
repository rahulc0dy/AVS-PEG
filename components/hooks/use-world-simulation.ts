import { World } from "@/lib/world";
import { RefObject, useEffect, useRef } from "react";
import { Camera } from "three";
import { OrbitControls } from "three/examples/jsm/Addons.js";

/**
 * Hook that runs the world simulation loop without any editor functionality.
 *
 * This hook is designed for the simulation view (/) and training view (/train)
 * where we want to run the world update loop but don't need graph/marking editors.
 *
 * Responsibilities:
 * - Updates `OrbitControls` each frame so damping and interactions are applied.
 * - Advances simulation each frame by calling `world.update()`.
 * - Calls `world.draw()` to render the world.
 * - Handles structural changes to the graph via `world.generate()`.
 *
 * @param worldRef - Ref to the World instance
 * @param camera - Three.js camera used by OrbitControls
 * @param dom - DOM element for OrbitControls
 */
export function useWorldSimulation(
  worldRef: RefObject<World | null>,
  camera: Camera,
  dom: HTMLElement,
) {
  const controlsRef = useRef<OrbitControls | null>(null);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    // Create orbit controls for camera manipulation
    controlsRef.current = new OrbitControls(camera, dom);

    let mounted = true;
    let lastTimestamp = performance.now();
    let previousGraphChanges = -1;

    const animate = () => {
      if (!mounted) return;

      frameRef.current = requestAnimationFrame(animate);

      const now = performance.now();
      const deltaSeconds = (now - lastTimestamp) / 1000;
      lastTimestamp = now;

      controlsRef.current?.update();

      const world = worldRef.current;
      const graph = world?.graph;

      if (!world || !graph) return;

      // Detect structural changes in the graph
      const changes = graph.getChanges();
      if (changes !== previousGraphChanges) {
        world.generate();
        previousGraphChanges = changes;
        world.draw();
        return;
      }

      // Advance simulation
      world.update(deltaSeconds);
    };

    animate();

    return () => {
      mounted = false;
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
      if (controlsRef.current) {
        controlsRef.current.dispose();
        controlsRef.current = null;
      }
    };
  }, [worldRef, camera, dom]);

  return { controlsRef };
}
