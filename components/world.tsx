import { GraphEditor } from "@/lib/editors/graph-editor";
import { Graph } from "@/lib/primitives/graph";
import { World } from "@/lib/world";
import { useCallback, useEffect, useRef } from "react";
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
  const graphRef = useRef<Graph | null>(null);

  /** Mutable ref holding the current `Graph` instance (used across effects). */
  const worldRef = useRef<World | null>(null);
  /** Mutable ref holding the editor instance responsible for editing the graph. */
  const graphEditorRef = useRef<GraphEditor | null>(null);

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

    const handlePointerMove = (evt: PointerEvent) => {
      updatePointer(evt);
      graphEditor.handlePointerMove(getIntersectPoint());
    };

    const handlePointerDown = (evt: PointerEvent) => {
      updatePointer(evt);
      const intersectionPoint = getIntersectPoint();

      switch (evt.button) {
        case 0: // Left button
          graphEditor.handleLeftClick(intersectionPoint);
          break;
        case 2: // Right button
          graphEditor.handleRightClick(intersectionPoint);
          break;
      }
    };

    const handlePointerUp = (evt: PointerEvent) => {
      updatePointer(evt);
      const intersectionPoint = getIntersectPoint();
      graphEditor.handleClickRelease(intersectionPoint);
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

      const editor = graphEditorRef.current;
      const world = worldRef.current;
      const graph = graphRef.current;
      const editorChanged = editor?.draw() ?? false;

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

  return <></>;
}
