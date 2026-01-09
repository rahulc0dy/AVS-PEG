"use client";

import TrainingCanvas from "@/components/training-canvas";
import SceneCanvas from "@/components/scene-canvas";

/**
 * Training page - For training AI agents with multiple cars.
 *
 * Features:
 * - Spawns 100+ AI-controlled cars
 * - Provides controls for saving/loading AI brains
 * - Runs simulation without editor tools
 */
export default function TrainPage() {
  return (
    <SceneCanvas config={{ cameraPosition: { x: 0, y: 2000, z: 0 } }}>
      {(context) => (
        <TrainingCanvas
          scene={context.scene}
          camera={context.camera}
          renderer={context.renderer}
          dom={context.dom}
        />
      )}
    </SceneCanvas>
  );
}
