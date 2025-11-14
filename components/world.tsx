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

interface WorldComponentProps {
  scene: Scene;
  camera: Camera;
  dom: HTMLElement;
}

export default function WorldComponent({
  scene,
  camera,
  dom,
}: WorldComponentProps) {
  const graphRef = useRef<Graph | null>(null);
  const worldRef = useRef<World | null>(null);
  const graphEditorRef = useRef<GraphEditor | null>(null);

  const pointerRef = useRef(new Vector2());

  const controlsRef = useRef<OrbitControls | null>(null);
  const gridRef = useRef<GridHelper | null>(null);

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

  const raycasterRef = useRef(new Raycaster());

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

    const graphEditor = new GraphEditor(graph, scene);
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

    const handlePointerUp = () => {
      graphEditor.handleClickRelease();
    };

    dom.addEventListener("pointermove", handlePointerMove);
    dom.addEventListener("pointerdown", handlePointerDown);
    dom.addEventListener("pointerup", handlePointerUp);
    dom.addEventListener("contextmenu", (e) => e.preventDefault());

    return () => {
      dom.removeEventListener("pointermove", handlePointerMove);
      dom.removeEventListener("pointerdown", handlePointerDown);
      dom.removeEventListener("pointerup", handlePointerUp);
    };
  }, []);

  useEffect(() => {
    animate();
    function animate() {
      requestAnimationFrame(animate);
      controlsRef.current?.update();
      graphEditorRef.current?.draw();
      worldRef.current?.generate();
      worldRef.current?.draw();
    }
  }, [graphRef]);

  return <div></div>;
}
