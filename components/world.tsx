"use client";

import { useState } from "react";
import { Camera, Scene, WebGLRenderer } from "three";
import OsmModal from "@/components/osm-modal";
import Button from "@/components/ui/button";
import Image from "next/image";
import { MINIVIEW_HEIGHT, MINIVIEW_WIDTH, MINIVIEW_X, MINIVIEW_Y } from "@/env";
import { useWorldInput } from "./hooks/use-world-input";
import { useWorldEditors } from "./hooks/use-world-editors";
import { useWorldAnimation } from "./hooks/use-world-animation";
import { useMiniCamera } from "./hooks/use-mini-camera";
import { useWorldPersistence } from "./hooks/use-world-persistence";

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
      <div className="fixed right-4 bottom-4 z-100 text-gray-200">
        <p className="font-bold text-gray-100">
          Mode: <span className="text-green-300 uppercase">{activeMode}</span>
        </p>
      </div>
      <div
        className="pointer-events-none fixed bottom-4 left-4 z-10 border border-gray-200"
        style={{
          left: MINIVIEW_X,
          bottom: MINIVIEW_Y,
          width: MINIVIEW_WIDTH,
          height: MINIVIEW_HEIGHT,
        }}
      />
      <div className="fixed top-4 right-4 z-10 flex flex-col space-y-2">
        <Button
          onClick={() => setIsOsmModalOpen(true)}
          color="teal"
          className="text-xs"
        >
          Import from OSM
        </Button>
        <Button onClick={loadFromJson} color="teal" className="text-xs">
          Import from JSON
        </Button>
        <Button onClick={saveToJson} color="teal" className="text-xs">
          Save to JSON
        </Button>
      </div>
      <div className="fixed right-0 bottom-4 left-0 flex items-center justify-center gap-5">
        <Button
          onClick={() => setMode("graph")}
          color="white"
          style={{ filter: activeMode === "graph" ? "" : "grayscale(100%)" }}
        >
          <Image
            src={"/icons/graph.png"}
            alt="graph"
            width={30}
            height={50}
            className="size-6"
          />
        </Button>
        <Button
          onClick={() => setMode("traffic-lights")}
          color="white"
          style={{
            filter: activeMode === "traffic-lights" ? "" : "grayscale(100%)",
          }}
        >
          <Image
            src={"/icons/traffic-lights.png"}
            alt="graph"
            width={30}
            height={50}
            className="size-6 rotate-90"
          />
        </Button>
      </div>

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
