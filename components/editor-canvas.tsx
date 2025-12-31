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
import { useTrafficDetector } from "@/components/hooks/use-traffic-detector";
import { useWorld } from "@/components/hooks/use-world";
import { FpsMeter } from "@/components/ui/fps-meter";

interface EditorCanvasProps {
  scene: Scene;
  camera: Camera;
  renderer: WebGLRenderer;
  dom: HTMLElement;
}

/**
 * Editor canvas component that provides the full editing experience.
 *
 * This component includes:
 * - Graph editing (add/remove nodes and edges)
 * - Traffic light placement
 * - Source/destination marking
 * - Mini camera view
 * - File save/load functionality
 * - OSM import modal
 */
export default function EditorCanvas({
  scene,
  camera,
  renderer,
  dom,
}: EditorCanvasProps) {
  const [isOsmModalOpen, setIsOsmModalOpen] = useState(false);

  // Initialize the World instance
  const worldRef = useWorld(scene, { showGrid: true });

  const { updatePointer, getIntersectPoint } = useWorldInput(camera, dom);

  // Initialize editors (requires world to be ready)
  const {
    activeMode,
    setMode,
    graphEditorRef,
    trafficLightEditorRef,
    sourceDestinationEditorRef,
    controlsRef,
  } = useWorldEditors(
    worldRef.current,
    scene,
    camera,
    dom,
    updatePointer,
    getIntersectPoint,
  );

  // Run the animation loop with editor support
  useWorldAnimation(
    controlsRef,
    graphEditorRef,
    trafficLightEditorRef,
    sourceDestinationEditorRef,
    worldRef,
  );

  const { scanTraffic, detections } = useTrafficDetector();

  useMiniCamera(renderer, scene, camera, worldRef, scanTraffic);

  useEffect(() => {
    if (detections.length > 0) {
      console.log("Traffic Light Found!", detections);
    }
  }, [detections]);

  const { saveToJson, loadFromJson } = useWorldPersistence(worldRef);

  return (
    <>
      <FpsMeter />
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
          worldRef={worldRef}
        />
      )}
    </>
  );
}
