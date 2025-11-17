"use client";

import WorldComponent from "@/components/world";
import { setupScene } from "@/utils/rendering";
import { useEffect, useRef, useState } from "react";
import { Camera, Scene } from "three";
export default function CarPage() {
  /**
   * DOM container element used to mount the Three.js renderer canvas.
   * The ref is populated after the component mounts.
   */
  const mountRef = useRef<HTMLDivElement>(null);

  /**
   * When non-null, `renderContext` holds the ready-to-use `scene`, `camera`,
   * and renderer `dom` element produced by `setupScene`. We only render the
   * `WorldComponent` after these are available.
   */
  const [renderContext, setRenderContext] = useState<{
    scene: Scene;
    camera: Camera;
    dom: HTMLElement;
  } | null>(null);

  useEffect(() => {
    if (!mountRef.current) return;
    const mount = mountRef.current;

    const { scene, camera, renderer, resizeHandler } = setupScene(mount, {
      cameraPosition: { x: 0, y: 2000, z: 0 },
    });

    // Expose the scene/camera/dom to the WorldComponent by storing them
    // in state. `renderer.domElement` is the actual canvas element used for input
    // coordinate calculations (raycasting) in the editor.
    setRenderContext({ scene, camera, dom: renderer.domElement });

    return () => {
      setRenderContext(null);
      // Tear down the renderer and remove event listeners when unmounting.
      // `setAnimationLoop(null)` stops the renderer's requestAnimationFrame loop.
      renderer.setAnimationLoop(null);
      if (renderer.domElement.parentElement === mount) {
        mount.removeChild(renderer.domElement);
      }
      renderer.dispose();
      window.removeEventListener("resize", resizeHandler);
    };
  }, []);

  return (
    <div className="w-screen h-screen relative">
      <div ref={mountRef} className="w-full h-full" />
      {renderContext && (
        <WorldComponent
          scene={renderContext.scene}
          camera={renderContext.camera}
          dom={renderContext.dom}
        />
      )}
    </div>
  );
}
