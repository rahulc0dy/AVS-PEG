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

        const sin = Math.sin(car.angle);
        const cos = Math.cos(car.angle);

        const camX = car.position.x - sin * forward;
        const camZ = car.position.y - cos * forward;
        miniCam.position.set(camX, height, camZ);

        const targetX = car.position.x - sin * lookAhead;
        const targetZ = car.position.y - cos * lookAhead;
        miniCam.lookAt(targetX, height * 0.7, targetZ);
      } else {
        miniCam.position.set(0, 15, 25);
        miniCam.lookAt(0, 3, 0);
      }
    };

    const renderFrame = () => {
      renderer.setScissorTest(false);
      renderer.setViewport(
        0,
        0,
        renderer.domElement.width,
        renderer.domElement.height,
      );
      renderer.render(scene, camera);

      const vp = miniViewPortRef.current;
      const dpr = renderer.getPixelRatio();
      const x = Math.floor(vp.x * dpr);
      const y = Math.floor(vp.y * dpr);
      const w = Math.floor(vp.width * dpr);
      const h = Math.floor(vp.height * dpr);

      const miniCam = miniCamRef.current;
      if (miniCam) {
        const aspect = vp.width / vp.height;
        if (Math.abs(miniCam.aspect - aspect) > 1e-3) {
          miniCam.aspect = aspect;
          miniCam.updateProjectionMatrix();
        }
        updateMiniCam();
        renderer.setScissorTest(true);
        renderer.setScissor(x, y, w, h);
        renderer.setViewport(x, y, w, h);
        renderer.render(scene, miniCam);
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
