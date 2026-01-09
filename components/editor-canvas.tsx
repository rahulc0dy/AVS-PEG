"use client";

import { useEffect, useState, useCallback } from "react";
import { Camera, Scene, WebGLRenderer } from "three";
import OsmModal from "@/components/osm-modal";
import { useWorldInput } from "@/components/hooks/use-world-input";
import { useWorldEditors } from "@/components/hooks/use-world-editors";
import { useWorldAnimation } from "@/components/hooks/use-world-animation";
import { useWorldPersistence } from "@/components/hooks/use-world-persistence";
import { FileToolbar } from "@/components/world-ui/file-toolbar";
import { ModeControls } from "@/components/world-ui/mode-controls";
import { useWorld } from "@/components/hooks/use-world";
import { FpsMeter } from "@/components/ui/fps-meter";
import { SourceDestinationMarkingType } from "@/lib/editors/source-destination-editor";

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
  const [sourceDestMarkingType, setSourceDestMarkingType] =
    useState<SourceDestinationMarkingType>("source");

  // Initialize the World instance
  const { worldRef, world } = useWorld(scene, { showGrid: true });

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
    world, // Pass the state value, not ref, so editors re-initialize when world is ready
    scene,
    camera,
    dom,
    updatePointer,
    getIntersectPoint,
  );

  // Sync source-destination marking type with the editor
  useEffect(() => {
    const editor = sourceDestinationEditorRef.current;
    if (editor) {
      editor.setMarkingType(sourceDestMarkingType);
      // Set up callback to update UI when editor changes type (e.g., auto-switch after placing source)
      editor.setOnMarkingTypeChange((type) => {
        setSourceDestMarkingType(type);
      });
    }
  }, [sourceDestinationEditorRef, sourceDestMarkingType]);

  const handleSourceDestTypeChange = useCallback(
    (type: SourceDestinationMarkingType) => {
      setSourceDestMarkingType(type);
      const editor = sourceDestinationEditorRef.current;
      if (editor) {
        editor.setMarkingType(type);
      }
    },
    [sourceDestinationEditorRef],
  );

  // Run the animation loop with editor support
  useWorldAnimation(
    controlsRef,
    graphEditorRef,
    trafficLightEditorRef,
    sourceDestinationEditorRef,
    worldRef,
  );

  const { saveToJson, loadFromJson } = useWorldPersistence(worldRef);

  return (
    <>
      <FpsMeter />
      <ModeControls
        activeMode={activeMode}
        setMode={setMode}
        sourceDestinationMarkingType={sourceDestMarkingType}
        onSourceDestinationTypeChange={handleSourceDestTypeChange}
      />
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
