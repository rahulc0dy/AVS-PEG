"use client";

import { useEffect, useState } from "react";
import { Camera, Scene, WebGLRenderer } from "three";
import OsmModal from "@/components/osm-modal";
import { useWorldInput } from "@/components/hooks/use-world-input";
import { useWorldEditors } from "@/components/hooks/use-world-editors";
import { useWorldAnimation } from "@/components/hooks/use-world-animation";
import { useMiniCamera } from "@/components/hooks/use-mini-camera";
import { useWorldPersistence } from "@/components/hooks/use-world-persistence";
import { MiniMapOverlay } from "@/components/world-ui/mini-map-overlay";
import { FileToolbar } from "@/components/world-ui/file-toolbar";
import { ModeControls } from "@/components/world-ui/mode-controls";
import { useTrafficDetector } from "./hooks/use-traffic-detector";

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

  const { scanTraffic, detections } = useTrafficDetector();

  useMiniCamera(renderer, scene, camera, worldRef, scanTraffic);

  useEffect(() => {
    if (detections.length > 0) {
      console.log("Traffic Light Found!", detections);
      // Logic to stop the car can go here
    }
  }, [detections]);

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
