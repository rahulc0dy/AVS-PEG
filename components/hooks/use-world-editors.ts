import { GraphEditor } from "@/lib/editors/graph-editor";
import { TrafficLightEditor } from "@/lib/editors/traffic-light-editor";
import { Graph } from "@/lib/primitives/graph";
import { World } from "@/lib/world";
import { EditorMode } from "@/types/editor";
import { useEffect, useRef, useState } from "react";
import { Camera, GridHelper, Scene, Vector3 } from "three";
import { OrbitControls } from "three/examples/jsm/Addons.js";

export function useWorldEditors(
  scene: Scene,
  camera: Camera,
  dom: HTMLElement,
  updatePointer: (evt: PointerEvent) => void,
  getIntersectPoint: () => Vector3,
) {
  const [activeMode, setActiveMode] = useState<EditorMode>("graph");
  const modeRef = useRef<EditorMode>("graph");

  const graphRef = useRef<Graph | null>(null);
  const worldRef = useRef<World | null>(null);
  const graphEditorRef = useRef<GraphEditor | null>(null);
  const trafficLightEditorRef = useRef<TrafficLightEditor | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);

  const disableEditors = () => {
    graphEditorRef.current?.disable();
    trafficLightEditorRef.current?.disable();
  };

  const setMode = (mode: EditorMode) => {
    disableEditors();
    modeRef.current = mode;
    setActiveMode(mode);

    switch (mode) {
      case "graph":
        graphEditorRef.current?.enable();
        break;
      case "traffic-lights":
        trafficLightEditorRef.current?.enable();
        break;
    }
  };

  useEffect(() => {
    controlsRef.current = new OrbitControls(camera, dom);

    const grid = new GridHelper(1000, 40, 0x666666, 0x333333);
    grid.position.set(0, 0, 0);
    scene.add(grid);

    const graph = new Graph([], []);
    graphRef.current = graph;

    const graphEditor = new GraphEditor(graph, scene, (isDragging) => {
      if (controlsRef.current) {
        controlsRef.current.enabled = !isDragging;
      }
    });
    graphEditorRef.current = graphEditor;

    const world = new World(graph, scene);
    worldRef.current = world;

    const trafficLightEditor = new TrafficLightEditor(
      scene,
      world.roadBorders,
      world.markings,
      world.worldGroup,
    );
    trafficLightEditorRef.current = trafficLightEditor;

    modeRef.current = "graph";
    graphEditor.enable();

    return () => {
      if (controlsRef.current) {
        controlsRef.current.dispose();
        controlsRef.current = null;
      }
      if (worldRef.current) {
        worldRef.current.dispose();
        worldRef.current = null;
      }
      scene.remove(grid);
      grid.dispose();
    };
  }, [scene, camera, dom]);

  useEffect(() => {
    const handlePointerMove = (evt: PointerEvent) => {
      updatePointer(evt);
      const point = getIntersectPoint();

      switch (modeRef.current) {
        case "graph":
          graphEditorRef.current?.handlePointerMove(point);
          break;
        case "traffic-lights":
          trafficLightEditorRef.current?.handlePointerMove(point);
          break;
      }
    };

    const handlePointerDown = (evt: PointerEvent) => {
      updatePointer(evt);
      const intersectionPoint = getIntersectPoint();

      if (evt.button === 0) {
        switch (modeRef.current) {
          case "graph":
            graphEditorRef.current?.handleLeftClick(intersectionPoint);
            break;
          case "traffic-lights":
            trafficLightEditorRef.current?.handleLeftClick(intersectionPoint);
            break;
        }
      } else if (evt.button === 2) {
        switch (modeRef.current) {
          case "graph":
            graphEditorRef.current?.handleRightClick(intersectionPoint);
            break;
          case "traffic-lights":
            trafficLightEditorRef.current?.handleRightClick(intersectionPoint);
            break;
        }
      }
    };

    const handlePointerUp = (evt: PointerEvent) => {
      updatePointer(evt);
      const intersectionPoint = getIntersectPoint();
      switch (modeRef.current) {
        case "graph":
          graphEditorRef.current?.handleClickRelease(intersectionPoint);
          break;
        case "traffic-lights":
          trafficLightEditorRef.current?.handleClickRelease(intersectionPoint);
          break;
      }
    };

    const handleContextMenu = (e: MouseEvent) => e.preventDefault();

    dom.addEventListener("pointermove", handlePointerMove);
    dom.addEventListener("pointerdown", handlePointerDown);
    dom.addEventListener("pointerup", handlePointerUp);
    dom.addEventListener("contextmenu", handleContextMenu);

    return () => {
      dom.removeEventListener("pointermove", handlePointerMove);
      dom.removeEventListener("pointerdown", handlePointerDown);
      dom.removeEventListener("pointerup", handlePointerUp);
      dom.removeEventListener("contextmenu", handleContextMenu);
    };
  }, [dom, updatePointer, getIntersectPoint]);

  return {
    activeMode,
    setMode,
    graphRef,
    worldRef,
    graphEditorRef,
    trafficLightEditorRef,
    controlsRef,
  };
}
