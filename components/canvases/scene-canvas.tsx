"use client";

import { useRef } from "react";
import {
  useThreeScene,
  ThreeSceneConfig,
  ThreeSceneContext,
} from "@/components/hooks/use-three-scene";

/**
 * Props for the SceneCanvas component.
 */
interface SceneCanvasProps {
  /** Optional configuration for the Three.js scene */
  config?: ThreeSceneConfig;
  /** Render function that receives the scene context when ready */
  children: (context: ThreeSceneContext) => React.ReactNode;
  /** Optional CSS class for the container */
  className?: string;
}

/**
 * Reusable component that sets up a Three.js scene and provides
 * the context to its children via a render prop pattern.
 *
 * Handles creating and managing the Three.js scene lifecycle,
 * mounting the WebGL renderer canvas, and providing scene, camera,
 * renderer, and dom to children.
 */
export function SceneCanvas({
  config,
  children,
  className = "w-screen h-screen relative",
}: SceneCanvasProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const context = useThreeScene(mountRef, config);

  return (
    <div className={className}>
      <div ref={mountRef} className="w-full h-full" />
      {context && children(context)}
    </div>
  );
}

export default SceneCanvas;
