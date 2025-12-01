import {
  MINICAM_FAR,
  MINICAM_FORWARD,
  MINICAM_HEIGHT,
  MINICAM_LOOKAHEAD,
  MINICAM_NEAR,
  MINIVIEW_HEIGHT,
  MINIVIEW_WIDTH,
  MINIVIEW_X,
  MINIVIEW_Y,
  MINICAM_FOV,
} from "@/env";
import { World } from "@/lib/world";
import { RefObject, useEffect, useRef } from "react";
import { PerspectiveCamera, Scene, WebGLRenderer, Camera } from "three";

/**
 * React hook that creates and manages a small inset "mini" perspective camera
 * rendered inside the main Three.js `WebGLRenderer` as a scissored viewport.
 *
 * The mini camera follows the first car in `worldRef.current.cars[0]` when
 * available and otherwise uses a default fallback position. The hook attaches
 * a render callback to `renderer.setAnimationLoop` which performs the main
 * scene render and then renders the scene again from the mini camera into the
 * configured inset rectangle.
 *
 * @param renderer - The three.js `WebGLRenderer` used for both main and mini renders.
 * @param scene - The three.js `Scene` to render.
 * @param camera - The primary three.js `Camera` used for the main view.
 * @param worldRef - A React ref containing the `World` instance. The hook reads
 *                   `worldRef.current` to locate the first car to follow.
 * @returns An object with two refs:
 *  - `miniCamRef`: `RefObject<PerspectiveCamera | null>` — reference to the
 *     created mini `PerspectiveCamera` instance (null before creation).
 *  - `miniViewPortRef`: `RefObject<{ x: number; y: number; width: number; height: number }>`
 *     — the viewport rectangle (in CSS pixels) where the mini camera will render.
 */
export function useMiniCamera(
  renderer: WebGLRenderer,
  scene: Scene,
  camera: Camera,
  worldRef: RefObject<World | null>,
) {
  const miniCamRef = useRef<PerspectiveCamera | null>(null);
  const miniViewPortRef = useRef({
    x: MINIVIEW_X,
    y: MINIVIEW_Y,
    width: MINIVIEW_WIDTH,
    height: MINIVIEW_HEIGHT,
  });

  useEffect(() => {
    const miniCam = new PerspectiveCamera(
      MINICAM_FOV,
      16 / 9,
      MINICAM_NEAR,
      MINICAM_FAR,
    );
    // Create a small perspective camera used only for the inset view.
    // We initially use a placeholder aspect (16/9) and update it later
    // based on the configured mini viewport size.
    miniCamRef.current = miniCam;

    return () => {
      miniCamRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!renderer) return;

    const updateMiniCam = () => {
      const miniCam = miniCamRef.current;
      if (!miniCam) return;

      const world = worldRef.current;
      const car = world?.cars?.[0];

      if (car) {
        const height = MINICAM_HEIGHT;
        const forward = MINICAM_FORWARD;
        const lookAhead = MINICAM_LOOKAHEAD;

        // Compute camera offset behind the car using its heading (angle).
        // `sin` and `cos` map the car's heading to world X/Z offsets.
        const sin = Math.sin(car.angle);
        const cos = Math.cos(car.angle);

        // Position the mini camera a bit behind and above the car so it
        // provides an overview rather than an exact first-person view.
        const camX = car.position.x - sin * forward;
        const camZ = car.position.y - cos * forward;
        miniCam.position.set(camX, height, camZ);

        // Look slightly ahead of the car so the direction of travel is visible.
        const targetX = car.position.x - sin * lookAhead;
        const targetZ = car.position.y - cos * lookAhead;
        miniCam.lookAt(targetX, height * 0.7, targetZ);
      } else {
        // Default fallback camera pose when no car exists.
        miniCam.position.set(0, 15, 25);
        miniCam.lookAt(0, 3, 0);
      }
    };

    const renderFrame = () => {
      // Render the main scene first into the full canvas.
      renderer.setScissorTest(false);
      renderer.setViewport(
        0,
        0,
        renderer.domElement.width,
        renderer.domElement.height,
      );
      renderer.render(scene, camera);

      // Compute scaled viewport for the mini view using device pixel ratio.
      const vp = miniViewPortRef.current;
      const dpr = renderer.getPixelRatio();
      const x = Math.floor(vp.x * dpr);
      const y = Math.floor(vp.y * dpr);
      const w = Math.floor(vp.width * dpr);
      const h = Math.floor(vp.height * dpr);

      const miniCam = miniCamRef.current;
      if (miniCam) {
        // Keep the mini camera projection in sync with the viewport aspect.
        const aspect = vp.width / vp.height;
        if (Math.abs(miniCam.aspect - aspect) > 1e-3) {
          miniCam.aspect = aspect;
          miniCam.updateProjectionMatrix();
        }
        // Update mini camera transform based on the world/car state.
        updateMiniCam();

        // Enable scissor test and render only into the small rectangle.
        renderer.setScissorTest(true);
        renderer.setScissor(x, y, w, h);
        renderer.setViewport(x, y, w, h);
        renderer.render(scene, miniCam);
        // Disable scissor test so subsequent frames start clean.
        renderer.setScissorTest(false);
      }
    };

    renderer.setAnimationLoop(renderFrame);

    return () => {
      renderer.setAnimationLoop(null);
    };
  }, [renderer, scene, camera, worldRef]);

  return { miniCamRef, miniViewPortRef };
}
