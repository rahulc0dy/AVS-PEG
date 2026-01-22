import { GraphEditor } from "@/lib/editors/graph-editor";
import { SourceDestinationEditor } from "@/lib/editors/source-destination-editor";
import { TrafficLightEditor } from "@/lib/editors/traffic-light-editor";
import { World } from "@/lib/world/world";
import { EditorMode } from "@/types/editor";
import { useEffect, useRef, useState } from "react";
import { Camera, Scene, Vector3 } from "three";
import { OrbitControls } from "three/examples/jsm/Addons.js";
import { GraphEdgeType, SourceDestinationMarkingType } from "@/types/marking";

/**
 * Hook that wires up editors, controls, and input handling for a `World` instance.
 *
 * Initializes orbit controls, the graph/traffic/source-destination editors, and the
 * pointer/keyboard listeners that delegate to whichever tool is active.
 *
 * @param {World | null} world - World whose graphs, markings, and roads the editors mutate.
 * @param {Scene} scene - Three.js scene that hosts editor helpers and visual output.
 * @param {Camera} camera - Camera used for orbit controls and raycasting.
 * @param {HTMLElement} dom - DOM element that receives pointer events and anchors the controls.
 * @param {(evt: PointerEvent) => void} updatePointer - Updates the shared pointer/raycaster state before delegating events.
 * @param {() => Vector3} getIntersectPoint - Computes the current ground intersection point for editor actions.
 */
export function useWorldEditors(
  world: World | null,
  scene: Scene,
  camera: Camera,
  dom: HTMLElement,
  updatePointer: (evt: PointerEvent) => void,
  getIntersectPoint: () => Vector3,
) {
  const [activeMode, setActiveMode] = useState<EditorMode>("graph");
  const [graphRoadType, setGraphRoadType] =
    useState<GraphEdgeType>("undirected");
  const [sourceDestMarkingType, setSourceDestMarkingType] =
    useState<SourceDestinationMarkingType>("source");

  const modeRef = useRef<EditorMode>("graph");

  const graphEditorRef = useRef<GraphEditor | null>(null);
  const trafficLightEditorRef = useRef<TrafficLightEditor | null>(null);
  const sourceDestinationEditorRef = useRef<SourceDestinationEditor | null>(
    null,
  );
  const controlsRef = useRef<OrbitControls | null>(null);

  const disableEditors = () => {
    graphEditorRef.current?.disable();
    trafficLightEditorRef.current?.disable();
    sourceDestinationEditorRef.current?.disable();
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
      case "source-destination":
        sourceDestinationEditorRef.current?.enable();
        break;
    }
  };

  // Sync state with the editor instance
  useEffect(() => {
    if (graphEditorRef.current) {
      graphEditorRef.current.drawDirectedEdge = graphRoadType === "directed";
    }
    if (sourceDestinationEditorRef.current) {
      sourceDestinationEditorRef.current.setMarkingType(sourceDestMarkingType);
    }
  }, [graphRoadType, sourceDestMarkingType]);

  useEffect(() => {
    if (!world) return;

    controlsRef.current = new OrbitControls(camera, dom);

    const graphEditor = new GraphEditor(world.graph, scene, (isDragging) => {
      if (controlsRef.current) {
        controlsRef.current.enabled = !isDragging;
      }
    });
    // Initialize with current state
    graphEditor.drawDirectedEdge = graphRoadType === "directed";
    graphEditorRef.current = graphEditor;

    trafficLightEditorRef.current = new TrafficLightEditor(
      scene,
      world.roadBorders,
      world.markings,
      world.trafficLightGraph,
      world.worldGroup,
    );

    sourceDestinationEditorRef.current = new SourceDestinationEditor(
      scene,
      world.roadBorders,
      world.markings,
      world.worldGroup,
      () => world.updatePath(),
    );

    modeRef.current = "graph";
    graphEditor.enable();

    return () => {
      if (controlsRef.current) {
        controlsRef.current.dispose();
        controlsRef.current = null;
      }
      graphEditorRef.current?.disable();
      trafficLightEditorRef.current?.disable();
      sourceDestinationEditorRef.current?.disable();
      graphEditorRef.current?.dispose();
      trafficLightEditorRef.current?.dispose();
      sourceDestinationEditorRef.current?.dispose();
      graphEditorRef.current = null;
      trafficLightEditorRef.current = null;
      sourceDestinationEditorRef.current = null;
    };
  }, [world, scene, camera, dom]);

  useEffect(() => {
    // Don't set up event listeners until world and editors are ready
    if (!world) return;
    if (!graphEditorRef.current) return;

    // Pointer move: update raycaster pointer then forward the computed
    // ground intersection to the active editor for hover/preview behavior.
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
        case "source-destination":
          sourceDestinationEditorRef.current?.handlePointerMove(point);
          break;
      }
    };

    // Pointer down: translate pointer event to world-space intersection
    // and route left/right clicks to the active editor.
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
          case "source-destination":
            sourceDestinationEditorRef.current?.handleLeftClick(
              intersectionPoint,
            );
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
          case "source-destination":
            sourceDestinationEditorRef.current?.handleRightClick(
              intersectionPoint,
            );
            break;
        }
      }
    };

    // Pointer up: let the active editor finalize click/drag interactions.
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
        case "source-destination":
          sourceDestinationEditorRef.current?.handleClickRelease(
            intersectionPoint,
          );
          break;
      }
    };

    const handleContextMenu = (e: MouseEvent) => e.preventDefault();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Tab") {
        e.preventDefault();
        switch (modeRef.current) {
          case "graph":
            graphEditorRef.current?.handleTabKeyPress();
            break;
          case "traffic-lights":
            trafficLightEditorRef.current?.handleTabKeyPress();
            break;
          case "source-destination":
            sourceDestinationEditorRef.current?.handleTabKeyPress();
            break;
        }
      }
    };

    dom.addEventListener("pointermove", handlePointerMove);
    dom.addEventListener("pointerdown", handlePointerDown);
    dom.addEventListener("pointerup", handlePointerUp);
    dom.addEventListener("contextmenu", handleContextMenu);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      dom.removeEventListener("pointermove", handlePointerMove);
      dom.removeEventListener("pointerdown", handlePointerDown);
      dom.removeEventListener("pointerup", handlePointerUp);
      dom.removeEventListener("contextmenu", handleContextMenu);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [world, dom, updatePointer, getIntersectPoint]);

  return {
    activeMode,
    setMode,
    graphRoadType,
    setGraphRoadType,
    sourceDestMarkingType,
    setSourceDestMarkingType,
    graphEditorRef,
    trafficLightEditorRef,
    sourceDestinationEditorRef,
    controlsRef,
  };
}
