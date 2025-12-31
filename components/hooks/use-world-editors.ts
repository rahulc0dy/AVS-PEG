import { GraphEditor } from "@/lib/editors/graph-editor";
import { SourceDestinationEditor } from "@/lib/editors/source-destination-editor";
import { TrafficLightEditor } from "@/lib/editors/traffic-light-editor";
import { World } from "@/lib/world";
import { EditorMode } from "@/types/editor";
import { useEffect, useRef, useState } from "react";
import { Camera, GridHelper, Scene, Vector3 } from "three";
import { OrbitControls } from "three/examples/jsm/Addons.js";

/**
 * Hook to initialize and manage world editors and controls.
 *
 * This hook sets up `OrbitControls`, `GraphEditor`, `TrafficLightEditor`,
 * and `SourceDestinationEditor`, wiring pointer events to the active editor.
 *
 * NOTE: This hook requires a World instance to be provided. Use `useWorld` hook
 * to create the World instance first, then pass `worldRef.current` to this hook.
 *
 * @param {World} world - The World instance to edit.
 * @param {Scene} scene - Three.js scene to attach helpers and editor objects to.
 * @param {Camera} camera - Three.js camera used by `OrbitControls` and raycasting.
 * @param {HTMLElement} dom - DOM element used for pointer event listeners and control target.
 * @param {(evt: PointerEvent) => void} updatePointer - Callback that updates the pointer/raycaster state.
 * @param {() => Vector3} getIntersectPoint - Function that returns the current pointer intersection point on the ground plane.
 * @returns Object containing the current mode, setter, and refs for editors and controls.
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
  const modeRef = useRef<EditorMode>("graph");

  const graphEditorRef = useRef<GraphEditor | null>(null);
  const trafficLightEditorRef = useRef<TrafficLightEditor | null>(null);
  const sourceDestinationEditorRef = useRef<SourceDestinationEditor | null>(
    null,
  );
  const controlsRef = useRef<OrbitControls | null>(null);

  // Disable both editors (safe to call even if an editor isn't initialized)
  const disableEditors = () => {
    graphEditorRef.current?.disable();
    trafficLightEditorRef.current?.disable();
    sourceDestinationEditorRef.current?.disable();
  };

  // Switch the active editor mode and enable the corresponding editor.
  // Also keep a ref copy (`modeRef`) to read from event handlers without re-subscribing.
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

  useEffect(() => {
    // Don't initialize editors until world is ready
    if (!world) return;

    // Create orbit controls attached to the provided `dom` element so
    // camera orbiting is enabled for the user.
    controlsRef.current = new OrbitControls(camera, dom);

    // GraphEditor receives a callback that reports whether the user is
    // actively dragging. While dragging, disable OrbitControls to avoid
    // camera interference with editor interactions.
    const graphEditor = new GraphEditor(world.graph, scene, (isDragging) => {
      if (controlsRef.current) {
        controlsRef.current.enabled = !isDragging;
      }
    });
    graphEditorRef.current = graphEditor;

    const trafficLightEditor = new TrafficLightEditor(
      scene,
      world.roadBorders,
      world.markings,
      world.trafficLightGraph,
      world.worldGroup,
    );
    trafficLightEditorRef.current = trafficLightEditor;

    const sourceDestinationEditor = new SourceDestinationEditor(
      scene,
      world.roadBorders,
      world.markings,
      world.worldGroup,
    );
    sourceDestinationEditorRef.current = sourceDestinationEditor;

    modeRef.current = "graph";
    graphEditor.enable();

    // Cleanup created resources when the component unmounts or deps change.
    return () => {
      if (controlsRef.current) {
        controlsRef.current.dispose();
        controlsRef.current = null;
      }
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
    graphEditorRef,
    trafficLightEditorRef,
    sourceDestinationEditorRef,
    controlsRef,
  };
}
