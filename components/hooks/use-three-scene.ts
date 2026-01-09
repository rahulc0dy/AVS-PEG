import { setupScene } from "@/utils/rendering";
import { useEffect, useRef, useState } from "react";
import { Camera, PerspectiveCamera, Scene, WebGLRenderer } from "three";

/**
 * Configuration options for the Three.js scene setup.
 */
export interface ThreeSceneConfig {
  /** Initial camera position */
  cameraPosition?: { x?: number; y?: number; z?: number };
  /** Background color as hex number */
  bgColor?: number;
}

/**
 * Return type for the useThreeScene hook.
 */
export interface ThreeSceneContext {
  /** The Three.js scene */
  scene: Scene;
  /** The Three.js camera */
  camera: Camera;
  /** The WebGL renderer */
  renderer: WebGLRenderer;
  /** The renderer's DOM element (canvas) */
  dom: HTMLElement;
}

/**
 * Hook that manages the lifecycle of a Three.js scene, camera, and renderer.
 *
 * This hook handles:
 * - Creating the scene, camera, and renderer
 * - Mounting the renderer to the provided container
 * - Setting up resize handlers
 * - Cleanup on unmount
 *
 * @param mountRef - Ref to the container element where the renderer will be mounted
 * @param config - Optional configuration for the scene setup
 * @returns The scene context (scene, camera, renderer, dom) when ready, or null
 *
 * @example
 * ```tsx
 * const mountRef = useRef<HTMLDivElement>(null);
 * const context = useThreeScene(mountRef, { cameraPosition: { y: 2000 } });
 *
 * if (context) {
 *   // Scene is ready to use
 * }
 * ```
 */
export function useThreeScene(
  mountRef: React.RefObject<HTMLDivElement | null>,
  config?: ThreeSceneConfig,
): ThreeSceneContext | null {
  const [renderContext, setRenderContext] = useState<ThreeSceneContext | null>(
    null,
  );

  // Store config in ref to avoid re-running effect when config object changes
  const configRef = useRef(config);
  configRef.current = config;

  useEffect(() => {
    if (!mountRef.current) return;
    const mount = mountRef.current;
    const currentConfig = configRef.current;

    const { scene, camera, renderer, resizeHandler } = setupScene(mount, {
      cameraPosition: currentConfig?.cameraPosition ?? { x: 0, y: 2000, z: 0 },
      bgColor: currentConfig?.bgColor,
    });

    // Expose the scene/camera/dom for use by child components
    setRenderContext({ scene, camera, renderer, dom: renderer.domElement });

    return () => {
      setRenderContext(null);
      // Tear down the renderer and remove event listeners when unmounting.
      renderer.setAnimationLoop(null);
      if (renderer.domElement.parentElement === mount) {
        mount.removeChild(renderer.domElement);
      }
      renderer.dispose();
      window.removeEventListener("resize", resizeHandler);
    };
  }, [mountRef]);

  return renderContext;
}
