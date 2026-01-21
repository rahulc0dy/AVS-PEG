"use client";

import SceneCanvas from "@/components/canvases/scene-canvas";
import TrainingCanvas from "@/components/canvases/training-canvas";

/**
 * Training page - For training AI agents with multiple cars.
 *
 * Features:
 * - Spawns 100+ AI-controlled cars
 * - Provides controls for saving/loading AI brains
 * - Runs simulation without editor tools
 */
export default function TrainingPage() {
  return (
    <SceneCanvas config={{ cameraPosition: { x: 0, y: 2000, z: 0 } }}>
      {(context) => (
        <TrainingCanvas
          scene={context.scene}
          camera={context.camera}
          dom={context.dom}
        />
      )}
    </SceneCanvas>
  );
}
