import { GraphEditor } from "@/lib/editors/graph-editor";
import { Edge } from "@/lib/primitives/edge";
import { Node } from "@/lib/primitives/node";
import {
  BufferGeometry,
  Camera,
  GridHelper,
  Line,
  LineDashedMaterial,
  Material,
  Mesh,
  MeshStandardMaterial,
  Plane,
  Raycaster,
  Scene,
  SphereGeometry,
  Vector2,
  Vector3,
} from "three";
import { useCallback, useEffect, useRef, useState } from "react";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { World } from "@/lib/world";

interface GraphComponentProps {
  scene: Scene;
  camera: Camera;
  dom: HTMLElement;
}

export default function GraphEditorComponent({
  scene,
  camera,
  dom,
}: GraphComponentProps) {
  const [nodeCount, setNodeCount] = useState(0);
  const [edgeCount, setEdgeCount] = useState(0);
  const [selected, setSelected] = useState<Node | null>(null);
  const [hovered, setHovered] = useState<Node | null>(null);

  const editorRef = useRef<GraphEditor | null>(null);
  const raycasterRef = useRef(new Raycaster());
  const pointerRef = useRef(new Vector2());
  const dragPlaneRef = useRef(new Plane(new Vector3(0, 1, 0), 0)); // y = 0 (XZ plane)
  const nodeMeshesRef = useRef(new Map<Node, Mesh>());
  const edgeLinesRef = useRef(new Map<Edge, Line>());
  const dragStateRef = useRef<{
    node: Node | null;
    offset: Vector3;
    moved: boolean;
  }>({
    node: null,
    offset: new Vector3(),
    moved: false,
  });
  const isDraggingRef = useRef(false);
  const controlsRef = useRef<OrbitControls | null>(null);
  const connectionAnchorRef = useRef<Node | null>(null);
  const gridRef = useRef<GridHelper | null>(null);
  const worldRef = useRef<World | null>(null);

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

  const updateEdgeGeometryForNode = useCallback((node: Node) => {
    edgeLinesRef.current.forEach((line, edge) => {
      if (edge.n1 !== node && edge.n2 !== node) return;

      const geometry = line.geometry as BufferGeometry;
      geometry.setFromPoints([
        new Vector3(edge.n1.x, 0, edge.n1.y),
        new Vector3(edge.n2.x, 0, edge.n2.y),
      ]);
      const position = geometry.attributes.position;
      if (position) position.needsUpdate = true;
      line.computeLineDistances();
    });
  }, []);

  const syncVisuals = useCallback(
    (graph: GraphEditor) => {
      // Get the current state of the graph
      const currentNodes = graph.getNodes();
      const currentEdges = graph.getEdges();
      const selectedNode = graph.getSelected();
      const hoveredNode = graph.getHovered();

      const nodeSet = new Set(currentNodes);
      const edgeSet = new Set(currentEdges);

      // Remove any nodes that no longer exist in the graph
      nodeMeshesRef.current.forEach((mesh, node) => {
        if (nodeSet.has(node)) return;

        scene.remove(mesh);

        // Clean up resources
        mesh.geometry.dispose();
        (mesh.material as Material).dispose();

        nodeMeshesRef.current.delete(node);
      });

      // Add or update all current nodes
      currentNodes.forEach((node) => {
        let mesh = nodeMeshesRef.current.get(node);

        // If this node doesn't have a mesh yet, create one
        if (!mesh) {
          mesh = new Mesh(
            new SphereGeometry(2, 16, 16),
            new MeshStandardMaterial({ color: 0x4e9cff })
          );

          // Position the sphere where the node is located in the graph
          mesh.position.set(node.x, 0, node.y);
          mesh.userData.node = node;

          scene.add(mesh);

          nodeMeshesRef.current.set(node, mesh);
        } else {
          // Update position if the node moved
          mesh.position.set(node.x, 0, node.y);
        }

        // Change color based on interaction state (default / hover / selected)
        const material = mesh.material as MeshStandardMaterial;
        const COLORS = {
          default: 0x4e9cff,
          hover: 0xfff07a,
          selected: 0xff6b6b,
        };

        switch (node) {
          case selectedNode:
            material.color.setHex(COLORS.selected);
            break;
          case hoveredNode:
            material.color.setHex(COLORS.hover);
            break;
          default:
            material.color.setHex(COLORS.default);
        }
      });

      // Remove edges that no longer exist in the graph
      edgeLinesRef.current.forEach((line, edge) => {
        if (edgeSet.has(edge)) return;

        scene.remove(line);

        // Clean up resources
        line.geometry.dispose();
        (line.material as Material).dispose();

        edgeLinesRef.current.delete(edge);
      });

      // Add or update all current edges
      currentEdges.forEach((edge) => {
        let line = edgeLinesRef.current.get(edge);

        // Each edge connects two nodes - build points between them
        const points = [
          new Vector3(edge.n1.x, 0, edge.n1.y),
          new Vector3(edge.n2.x, 0, edge.n2.y),
        ];

        if (!line) {
          // If no line exists yet, create a dashed line
          const geometry = new BufferGeometry().setFromPoints(points);
          const material = new LineDashedMaterial({
            color: 0xffffff,
            dashSize: 2,
            gapSize: 1,
          });

          line = new Line(geometry, material);
          line.computeLineDistances(); // required for dashed lines to render
          line.userData.edge = edge;

          scene.add(line);
          edgeLinesRef.current.set(edge, line);
        } else {
          // Update existing line when nodes move
          const geometry = line.geometry as BufferGeometry;
          geometry.setFromPoints(points);
          geometry.attributes.position.needsUpdate = true;
          line.computeLineDistances();
        }
      });

      worldRef.current?.generate();
      worldRef.current?.draw();

      // Update some UI states
      setNodeCount(currentNodes.length);
      setEdgeCount(currentEdges.length);
      setSelected(selectedNode);
      setHovered(hoveredNode);
    },
    [scene]
  );

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

  const pickIntersection = useCallback(() => {
    // Get all the node meshes currently in the scene.
    // These are the clickable / hoverable spheres representing graph nodes.
    const meshes = Array.from(nodeMeshesRef.current.values());

    // Use the raycaster to check which of these meshes the mouse ray intersects.
    // intersectObjects() returns an array of all hits, sorted by distance from the camera.
    // We only care about the closest one (the first hit), so we return [0].
    return raycasterRef.current.intersectObjects(meshes, false)[0];
  }, []);

  useEffect(() => {
    if (!dom) return;

    const graphEditor = new GraphEditor({
      onChange: () => syncVisuals(graphEditor),
    });
    editorRef.current = graphEditor;
    worldRef.current = new World(editorRef.current, scene);

    syncVisuals(graphEditor);

    const handlePointerDown = (evt: PointerEvent) => {
      const editor = editorRef.current;
      if (!editor) return;

      updatePointer(evt);
      const intersection = pickIntersection();
      const hitNode = intersection
        ? ((intersection.object as Mesh).userData.node as Node)
        : undefined;

      if (evt.button === 2) {
        evt.preventDefault();
        if (connectionAnchorRef.current === hitNode) {
          connectionAnchorRef.current = null;
        }
        if (hitNode) editor.removeNode(hitNode);
        else {
          connectionAnchorRef.current = null;
          editor.selectNode(null);
        }
        return;
      }

      if (evt.button !== 0) return;

      if (intersection && hitNode) {
        editor.selectNode(hitNode);

        const mesh = nodeMeshesRef.current.get(hitNode);
        if (mesh) {
          dragStateRef.current.node = hitNode;
          dragStateRef.current.offset
            .copy(intersection.point)
            .sub(mesh.position);
          dragStateRef.current.moved = false;
          isDraggingRef.current = true;
          if (controlsRef.current) controlsRef.current.enabled = false;
        }
        return;
      }

      const planePoint = new Vector3();
      if (
        raycasterRef.current.ray.intersectPlane(
          dragPlaneRef.current,
          planePoint
        )
      ) {
        planePoint.y = 0;
        const node = new Node(planePoint.x, planePoint.z);
        editor.addNode(node, { connectToPrevious: false });
        connectionAnchorRef.current = node;
      }
    };

    const handlePointerMove = (evt: PointerEvent) => {
      const editor = editorRef.current;
      if (!editor) return;

      updatePointer(evt);
      const intersection = pickIntersection();
      const hitNode = intersection
        ? ((intersection.object as Mesh).userData.node as Node)
        : null;
      editor.setHovered(hitNode);

      if (!isDraggingRef.current || !dragStateRef.current.node) return;

      const planePoint = new Vector3();
      if (
        !raycasterRef.current.ray.intersectPlane(
          dragPlaneRef.current,
          planePoint
        )
      )
        return;

      planePoint.sub(dragStateRef.current.offset);
      planePoint.y = 0;

      const node = dragStateRef.current.node;
      const newX = planePoint.x;
      const newY = planePoint.z;

      if (Math.abs(node.x - newX) > 1e-4 || Math.abs(node.y - newY) > 1e-4) {
        dragStateRef.current.moved = true;
      }

      editor.moveNode(node, newX, newY);

      const mesh = nodeMeshesRef.current.get(node);
      if (mesh) mesh.position.set(node.x, 0, node.y);

      updateEdgeGeometryForNode(node);
    };

    const handlePointerUp = () => {
      const editor = editorRef.current;
      const dragState = dragStateRef.current;

      if (editor && dragState.node) {
        if (!dragState.moved) {
          const anchor = connectionAnchorRef.current;
          const clicked = dragState.node;
          if (anchor && anchor !== clicked) {
            editor.addEdge(anchor, clicked);
          }
          connectionAnchorRef.current = clicked;
          editor.selectNode(clicked);
        }
      }

      isDraggingRef.current = false;
      dragStateRef.current = {
        node: null,
        offset: new Vector3(),
        moved: false,
      };
      if (controlsRef.current) controlsRef.current.enabled = true;
    };

    const handleContextMenu = (evt: PointerEvent) => evt.preventDefault();

    dom.addEventListener("pointerdown", handlePointerDown);
    dom.addEventListener("pointermove", handlePointerMove);
    dom.addEventListener("pointerup", handlePointerUp);
    dom.addEventListener("contextmenu", handleContextMenu);

    return () => {
      graphEditor.setOnChange();
      graphEditor.dispose();
      editorRef.current = null;

      dom.removeEventListener("pointerdown", handlePointerDown);
      dom.removeEventListener("pointermove", handlePointerMove);
      dom.removeEventListener("pointerup", handlePointerUp);
      dom.removeEventListener("contextmenu", handleContextMenu);

      nodeMeshesRef.current.forEach((mesh) => {
        scene.remove(mesh);
        mesh.geometry.dispose();
        (mesh.material as Material).dispose();
      });
      nodeMeshesRef.current.clear();

      edgeLinesRef.current.forEach((line) => {
        scene.remove(line);
        line.geometry.dispose();
        (line.material as Material).dispose();
      });
      edgeLinesRef.current.clear();

      setNodeCount(0);
      setEdgeCount(0);
      setSelected(null);
      setHovered(null);
      connectionAnchorRef.current = null;
    };
  }, [
    dom,
    scene,
    updatePointer,
    pickIntersection,
    updateEdgeGeometryForNode,
    syncVisuals,
  ]);

  return (
    <div className="graph-editor-ui fixed top-0.5 left-0.5 text-white pointer-events-none">
      <div className="stats">
        <p>Nodes: {nodeCount}</p>
        <p>Edges: {edgeCount}</p>
      </div>
      <div className="info">
        {selected && (
          <p>
            Selected: ({selected.x.toFixed(2)}, {selected.y.toFixed(2)})
          </p>
        )}
        {hovered && (
          <p>
            Hovered: ({hovered.x.toFixed(2)}, {hovered.y.toFixed(2)})
          </p>
        )}
      </div>
    </div>
  );
}
