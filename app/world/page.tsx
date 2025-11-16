"use client";

import WorldComponent from "@/components/world";
import { setupScene } from "@/utils/rendering";
import { useEffect, useRef, useState } from "react";
import { Camera, Scene } from "three";
export default function CarPage() {
  const mountRef = useRef<HTMLDivElement>(null);
  const [graphProps, setGraphProps] = useState<{
    scene: Scene;
    camera: Camera;
    dom: HTMLElement;
  } | null>(null);

  useEffect(() => {
    if (!mountRef.current) return;
    const mount = mountRef.current;

    const { scene, camera, renderer, resizeHandler } = setupScene(mount, {
      cameraPosition: { x: 0, y: 60, z: 420 },
    });

    setGraphProps({ scene, camera, dom: renderer.domElement });

    return () => {
      setGraphProps(null);
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
      {graphProps && (
        <WorldComponent
          scene={graphProps.scene}
          camera={graphProps.camera}
          dom={graphProps.dom}
        />
      )}
    </div>
  );
}
