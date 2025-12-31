"use client";

import EditorCanvas from "@/components/editor-canvas";
import SceneCanvas from "@/components/scene-canvas";

/**
 * Edit page - The full world editor with graph editing,
 * traffic light placement, and source/destination marking.
 */
export default function EditPage() {
  return (
    <SceneCanvas config={{ cameraPosition: { x: 0, y: 2000, z: 0 } }}>
      {(context) => (
        <EditorCanvas
          scene={context.scene}
          camera={context.camera}
          renderer={context.renderer}
          dom={context.dom}
        />
      )}
    </SceneCanvas>
  );
}
