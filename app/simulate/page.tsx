"use client";

import SceneCanvas from "@/components/canvases/scene-canvas";
import SimulationCanvas from "@/components/canvases/simulation-canvas";

/**
 * Simulation page - Manual driving on a loaded world JSON.
 *
 * Features:
 * - Load a saved world file
 * - Spawn a human-controlled car (WASD / Arrow keys)
 * - Run simulation without editor tooling
 */
export default function SimulationPage() {
  return (
    <SceneCanvas config={{ cameraPosition: { x: 0, y: 2000, z: 0 } }}>
      {(context) => (
        <SimulationCanvas
          scene={context.scene}
          camera={context.camera}
          dom={context.dom}
        />
      )}
    </SceneCanvas>
  );
}
