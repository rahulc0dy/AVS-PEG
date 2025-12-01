"use client";

import { useState } from "react";
import { Camera, Scene, WebGLRenderer } from "three";
import OsmModal from "@/components/osm-modal";
import { useWorldInput } from "./hooks/use-world-input";
import { useWorldEditors } from "./hooks/use-world-editors";
import { useWorldAnimation } from "./hooks/use-world-animation";
import { useMiniCamera } from "./hooks/use-mini-camera";
import { useWorldPersistence } from "./hooks/use-world-persistence";
import { MiniMapOverlay } from "./world-ui/mini-map-overlay";
import { FileToolbar } from "./world-ui/file-toolbar";
import { ModeControls } from "./world-ui/mode-controls";

interface WorldComponentProps {
  scene: Scene;
  camera: Camera;
  renderer: WebGLRenderer;
  dom: HTMLElement;
}

export default function WorldComponent({
  scene,
  camera,
  renderer,
  dom,
}: WorldComponentProps) {
  const [isOsmModalOpen, setIsOsmModalOpen] = useState(false);

  const { updatePointer, getIntersectPoint } = useWorldInput(camera, dom);

  const {
    activeMode,
    setMode,
    graphRef,
    worldRef,
    graphEditorRef,
    trafficLightEditorRef,
    controlsRef,
  } = useWorldEditors(scene, camera, dom, updatePointer, getIntersectPoint);

  useWorldAnimation(
    controlsRef,
    graphEditorRef,
    trafficLightEditorRef,
    worldRef,
    graphRef,
  );

  useMiniCamera(renderer, scene, camera, worldRef);

  const { saveToJson, loadFromJson } = useWorldPersistence(worldRef, graphRef);

  return (
    <>
      <ModeControls activeMode={activeMode} setMode={setMode} />
      <MiniMapOverlay />
      <FileToolbar
        onImportOsm={() => setIsOsmModalOpen(true)}
        onLoadJson={loadFromJson}
        onSaveJson={saveToJson}
      />

      {isOsmModalOpen && (
        <OsmModal
          isOpen={isOsmModalOpen}
          onClose={() => setIsOsmModalOpen(false)}
          graphRef={graphRef}
        />
      )}
    </>
  );
}
