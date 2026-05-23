"use client";

import { useState } from "react";
import { Camera, Scene } from "three";
import OsmModal from "@/components/world-ui/osm-modal";
import { useWorldInput } from "@/components/hooks/use-world-input";
import { useWorldEditors } from "@/components/hooks/use-world-editors";
import { useWorldAnimation } from "@/components/hooks/use-world-animation";
import { useWorldPersistence } from "@/components/hooks/use-world-persistence";
import { FileToolbar } from "@/components/world-ui/file-toolbar";
import { ModeControls } from "@/components/world-ui/mode-controls";
import { PathPanel } from "@/components/world-ui/path-panel";
import { EditorGuide } from "@/components/world-ui/editor-guide";
import { useWorld } from "@/components/hooks/use-world";

interface EditorCanvasProps {
  scene: Scene;
  camera: Camera;
  dom: HTMLElement;
}

/**
 * Editor canvas component that provides the full editing experience.
 *
 * Includes graph editing, traffic light placement, source/destination marking,
 * file save/load functionality, OSM import modal, and a contextual guide panel
 * that displays controls for the active editor mode.
 */
export default function EditorCanvas({
  scene,
  camera,
  dom,
}: EditorCanvasProps) {
  const [isOsmModalOpen, setIsOsmModalOpen] = useState(false);

  // Initialize the World instance
  const { worldRef, world } = useWorld(scene, { showGrid: true });

  const { updatePointer, getIntersectPoint } = useWorldInput(camera, dom);

  // Initialize editors (requires world to be ready)
  const {
    activeMode,
    setMode,
    graphRoadType,
    setGraphRoadType,
    sourceDestMarkingType,
    setSourceDestMarkingType,
    graphEditorRef,
    trafficLightEditorRef,
    stopSignEditorRef,
    sourceDestinationEditorRef,
    pathEditorRef,
    controlsRef,
  } = useWorldEditors(
    world,
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
    stopSignEditorRef,
    pathEditorRef,
    worldRef,
  );

  const { saveToJson, loadFromJson } = useWorldPersistence(worldRef);

  return (
    <>
      <ModeControls
        activeMode={activeMode}
        setMode={setMode}
        graphRoadType={graphRoadType}
        onGraphRoadTypeChange={setGraphRoadType}
        sourceDestinationMarkingType={sourceDestMarkingType}
        onSourceDestinationTypeChange={setSourceDestMarkingType}
      />

      <EditorGuide
        activeMode={activeMode}
        graphRoadType={graphRoadType}
        sourceDestMarkingType={sourceDestMarkingType}
      />

      {activeMode === "path" && (
        <PathPanel
          isVisible={activeMode === "path"}
          editorRef={pathEditorRef}
        />
      )}

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
