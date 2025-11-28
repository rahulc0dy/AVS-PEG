"use client";

import { GraphEditor } from "@/lib/editors/graph-editor";
import { Graph } from "@/lib/primitives/graph";
import { World } from "@/lib/world";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Camera,
  GridHelper,
  Plane,
  Raycaster,
  Scene,
  Vector2,
  Vector3,
} from "three";
import { OrbitControls } from "three/examples/jsm/Addons.js";
import OsmModal from "@/components/osm-modal";
import Button from "@/components/ui/button";
import Image from "next/image";
import { EditorMode } from "@/types/editor";
import { TrafficLightEditor } from "@/lib/traffic-light-editor";

/**
 * Props for the `WorldComponent` React component.
 * - `scene`: Three.js scene instance to render into
 * - `camera`: Active camera used for raycasting and orbit controls
 * - `dom`: DOM element (canvas container) used to compute pointer coordinates
 */
interface WorldComponentProps {
  scene: Scene;
  camera: Camera;
  dom: HTMLElement;
}

/**
 * React component that wires the 3D world together: sets up orbit controls,
 * a visual grid, pointer-to-world raycasting, and the editor/world
 * instances (graph, GraphEditor, World). It handles pointer events and runs
 * the animation loop that updates editor visuals and regenerates world
 * geometry when the graph changes.
 */
export default function WorldComponent({
  scene,
  camera,
  dom,
}: WorldComponentProps) {
  const [isOsmModalOpen, setIsOsmModalOpen] = useState(false);
  const [activeMode, setActiveMode] = useState<EditorMode>("graph");

  const graphRef = useRef<Graph | null>(null);

  const modeRef = useRef<EditorMode>("graph");

  /** Mutable ref holding the current `Graph` instance (used across effects). */
  const worldRef = useRef<World | null>(null);
  /** Mutable ref holding the editor instance responsible for editing the graph. */
  const graphEditorRef = useRef<GraphEditor | null>(null);
  const trafficLightEditorRef = useRef<TrafficLightEditor | null>(null);

  /**
   * Pointer coordinates in normalized device coordinates (NDC) used by the
   * `Raycaster` for picking. `x`/`y` are in [-1, 1].
   */
  const pointerRef = useRef(new Vector2());

  /** Orbit controls instance controlling the camera. */
  const controlsRef = useRef<OrbitControls | null>(null);
  /** Visual grid helper added to the scene for orientation. */
  const gridRef = useRef<GridHelper | null>(null);
  /** requestAnimationFrame id returned by `requestAnimationFrame`. */
  const frameRef = useRef<number | null>(null);

  /* Button refs */
  const graphButton = useRef<HTMLButtonElement | null>(null);
  const trafficSignalButton = useRef<HTMLButtonElement | null>(null);

  const setMode = (mode: EditorMode) => {
    disableEditors();
    modeRef.current = mode;
    setActiveMode(mode);

    // Reset button styles (grayscale all)
    if (graphButton.current)
      graphButton.current.style.filter = "grayscale(100%)";
    if (trafficSignalButton.current)
      trafficSignalButton.current.style.filter = "grayscale(100%)";

    // Enable specific editor and highlight button
    switch (mode) {
      case "graph":
        if (graphButton.current) graphButton.current.style.filter = "";
        graphEditorRef.current?.enable();
        break;
      case "traffic-lights":
        if (trafficSignalButton.current)
          trafficSignalButton.current.style.filter = "";
        trafficLightEditorRef.current?.enable();
        break;
      case "crossing":
        // crossingEditorRef.current?.enable();
        break;
    }
  };

  const disableEditors = () => {
    graphEditorRef.current?.disable();
    trafficLightEditorRef.current?.disable();
  };

  // Setup OrbitControls, Visual Grid
  useEffect(() => {
    controlsRef.current = new OrbitControls(camera, dom);

    const grid = new GridHelper(1000, 40, 0x666666, 0x333333);
    grid.position.set(0, 0, 0);
    gridRef.current = grid;

    scene.add(grid);

    return () => {
      if (controlsRef.current) {
        controlsRef.current.dispose();
        controlsRef.current = null;
      }

      if (gridRef.current) {
        scene.remove(gridRef.current);
        gridRef.current.dispose();
        gridRef.current = null;
      }
    };
  }, [scene, camera, dom]);

  /** Raycaster used to convert pointer NDC into a world-space picking ray. */
  const raycasterRef = useRef(new Raycaster());
  /**
   * Update the normalized device coordinates used for raycasting from a
   * PointerEvent. Converts screen coordinates to NDC (-1..1) and updates the
   * internal `Raycaster` with the active camera.
   */
  const updatePointer = useCallback(
    (evt: PointerEvent) => {
      // Get the bounding box of the canvas (so we can normalize mouse coordinates)
      const rect = dom.getBoundingClientRect();

      // Convert the pointer's screen position into normalized device coordinates (NDC)
      // where (0,0) is the center of the screen, and range is [-1, 1] for both axes.
      // This is what Three.js expects for raycasting.
      pointerRef.current.x = ((evt.clientX - rect.left) / rect.width) * 2 - 1;
      pointerRef.current.y = -((evt.clientY - rect.top) / rect.height) * 2 + 1;

      // Update the raycaster with the new pointer position and the active camera.
      // This allows Three.js to cast a ray from the camera through the mouse cursor
      // into the 3D scene, which can be used for detecting intersections.
      raycasterRef.current.setFromCamera(pointerRef.current, camera);
    },
    [camera, dom]
  );

  /**
   * Returns the world-space intersection point between the current ray
   * (set by `updatePointer`) and a horizontal plane at y=0. The returned
   * vector contains the intersection coordinates; when the ray is parallel
   * to the plane the returned vector remains unchanged.
   */
  const getIntersectPoint = useCallback((): Vector3 => {
    // Use the raycaster that was updated by updatePointer to cast a ray
    const raycaster = raycasterRef.current;

    // Create a horizontal plane (y-up) at the world origin.
    // The normal (0, 1, 0) makes this a horizontal plane.
    const intersectingPlaneNormal = new Vector3(0, 1, 0);
    const plane = new Plane(intersectingPlaneNormal);

    // Vector to receive the intersection point in world space.
    const intersectPoint = new Vector3();

    // Intersect the ray with the plane. If the ray is parallel to the plane,
    // intersectPlane will return null and intersectPoint will remain unchanged.
    raycaster.ray.intersectPlane(plane, intersectPoint);

    // Return the computed intersection point (or the unchanged vector if no intersection).
    return intersectPoint;
  }, []);

  useEffect(() => {
    const graph = new Graph([], []);
    graphRef.current = graph;

    const graphEditor = new GraphEditor(graph, scene, (isDragging) => {
      // Disable orbit controls while dragging a node
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
      world.markings
    );
    trafficLightEditorRef.current = trafficLightEditor;

    modeRef.current = "graph";
    graphEditor.enable();

    // Initialize button styles
    if (graphButton.current) graphButton.current.style.filter = "";
    if (trafficSignalButton.current)
      trafficSignalButton.current.style.filter = "grayscale(100%)";

    const handlePointerMove = (evt: PointerEvent) => {
      updatePointer(evt);
      const point = getIntersectPoint();

      switch (modeRef.current) {
        case "graph":
          graphEditor.handlePointerMove(point);
          break;
        case "traffic-lights":
          trafficLightEditor.handlePointerMove(point);
          break;
      }
    };

    const handlePointerDown = (evt: PointerEvent) => {
      updatePointer(evt);
      const intersectionPoint = getIntersectPoint();

      if (evt.button === 0) {
        // Left button
        switch (modeRef.current) {
          case "graph":
            graphEditor.handleLeftClick(intersectionPoint);
            break;
          case "traffic-lights":
            trafficLightEditor.handleLeftClick(intersectionPoint);
            break;
        }
      } else if (evt.button === 2) {
        // Right button
        switch (modeRef.current) {
          case "graph":
            graphEditor.handleRightClick(intersectionPoint);
            break;
          case "traffic-lights":
            trafficLightEditor.handleRightClick(intersectionPoint);
            break;
        }
      }
    };

    const handlePointerUp = (evt: PointerEvent) => {
      updatePointer(evt);
      const intersectionPoint = getIntersectPoint();
      switch (modeRef.current) {
        case "graph":
          graphEditor.handleClickRelease(intersectionPoint);
          break;
        case "traffic-lights":
          trafficLightEditor.handleClickRelease(intersectionPoint);
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
  }, [camera, dom, scene, updatePointer, getIntersectPoint]);

  useEffect(() => {
    let previousGraphChanges = -1;
    let mounted = true;

    /**
     *  Animation loop: update controls, redraw editor visuals when needed,
     * and regenerate / redraw world geometry when the graph changes.
     */
    const animate = () => {
      if (!mounted) return;
      frameRef.current = requestAnimationFrame(animate);

      controlsRef.current?.update();

      const gEditor = graphEditorRef.current;
      const tlEditor = trafficLightEditorRef.current;
      const world = worldRef.current;
      const graph = graphRef.current;

      const editorChanged =
        (gEditor?.draw() ?? false) || (tlEditor?.draw() ?? false);

      if (!world || !graph) {
        return;
      }

      const changes = graph.getChanges();

      // If the graph has changed since the last frame, regenerate world
      // geometry (envelopes, unions) and redraw.
      if (changes !== previousGraphChanges) {
        world.generate();
        previousGraphChanges = changes;
        world.draw();
        if (tlEditor) {
          tlEditor.targetEdges = world.roadBorders;
        }
        return;
      }

      // If only the editor visuals changed (hover/selection), redraw world
      // to reflect any editor-driven appearance changes.
      if (editorChanged) {
        world.draw();
      }

      // Update worlds state every frame
      world.update();
    };

    animate();

    return () => {
      mounted = false;
      if (worldRef.current) {
        worldRef.current.dispose();
        worldRef.current = null;
      }
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, []);

  const saveToJson = () => {
    const world = worldRef.current;
    if (!world) return;

    const json = JSON.stringify(world.toJson());
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "world.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const loadFromJson = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json, .json";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev: ProgressEvent<FileReader>) => {
        try {
          const text = ev.target?.result as string;
          const parsed = JSON.parse(text);
          const world = worldRef.current;
          if (!world) return;

          // Let the world parse and load the JSON (will update its graph)
          world.fromJson(parsed);

          // Ensure graphRef points to the same Graph instance used by World
          graphRef.current = world.graph;

          // Redraw
          world.draw();
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error("Failed to load world JSON:", err);
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  return (
    <>
      <div className="fixed bottom-4 right-4 z-100 text-gray-200">
        <p className="font-bold text-gray-100">
          Mode: <span className="text-green-300 uppercase">{activeMode}</span>
        </p>
      </div>
      <div className="flex flex-col space-y-2 fixed top-4 right-4 z-10">
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
      <div className="fixed bottom-4 left-0 right-0 flex items-center justify-center gap-5">
        <Button
          onClick={() => setMode("graph")}
          color="white"
          ref={graphButton}
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
          ref={trafficSignalButton}
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
