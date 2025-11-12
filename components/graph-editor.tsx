import { GraphEditor } from "@/lib/editors/graph-editor";
import { Edge } from "@/lib/primitives/edge";
import { Node } from "@/lib/primitives/node";
import {
  BufferGeometry,
  Camera,
  DoubleSide,
  GridHelper,
  Line,
  LineDashedMaterial,
  Material,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Plane,
  PlaneGeometry,
  Raycaster,
  Scene,
  SphereGeometry,
  Vector2,
  Vector3,
} from "three";
import { useCallback, useEffect, useRef, useState } from "react";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

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
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
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
  const planeRef = useRef<Mesh | null>(null);

  useEffect(() => {
    const controls = new OrbitControls(camera, dom);
    controls.enableDamping = true;
    controls.enablePan = true;
    controls.enableZoom = true;
    controlsRef.current = controls;

    const grid = new GridHelper(1000, 40, 0x666666, 0x333333);
    grid.position.set(0, 0, 0);

    const plane = new Mesh(
      new PlaneGeometry(1000, 1000),
      new MeshBasicMaterial({
        color: 0x11171f,
        opacity: 0.2,
        transparent: true,
        side: DoubleSide,
      })
    );
    plane.rotation.x = -Math.PI / 2;
    plane.position.set(0, 0, 0);

    scene.add(grid);
    scene.add(plane);
    gridRef.current = grid;
    planeRef.current = plane;

    return () => {
      controls.dispose();
      controlsRef.current = null;

      if (gridRef.current) {
        scene.remove(gridRef.current);
        gridRef.current.dispose();
        gridRef.current = null;
      }
      if (planeRef.current) {
        scene.remove(planeRef.current);
        planeRef.current.geometry.dispose();
        (planeRef.current.material as Material).dispose();
        planeRef.current = null;
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
      const currentNodes = graph.getNodes();
      const nodeSet = new Set(currentNodes);
      const selectedNode = graph.getSelected();
      const hoveredNode = graph.getHovered();

      nodeMeshesRef.current.forEach((mesh, node) => {
        if (nodeSet.has(node)) return;
        scene.remove(mesh);
        mesh.geometry.dispose();
        (mesh.material as Material).dispose();
        nodeMeshesRef.current.delete(node);
      });

      currentNodes.forEach((node) => {
        let mesh = nodeMeshesRef.current.get(node);
        if (!mesh) {
          mesh = new Mesh(
            new SphereGeometry(2, 16, 16),
            new MeshStandardMaterial({ color: 0x4e9cff })
          );
          mesh.position.set(node.x, 0, node.y);
          mesh.userData.node = node;
          scene.add(mesh);
          nodeMeshesRef.current.set(node, mesh);
        } else {
          mesh.position.set(node.x, 0, node.y);
        }

        const material = mesh.material as MeshStandardMaterial;
        const baseColor = 0x4e9cff;
        const hoverColor = 0xfff07a;
        const selectedColor = 0xff6b6b;

        if (selectedNode === node) {
          material.color.setHex(selectedColor);
        } else if (hoveredNode === node) {
          material.color.setHex(hoverColor);
        } else {
          material.color.setHex(baseColor);
        }
      });

      const currentEdges = graph.getEdges();
      const edgeSet = new Set(currentEdges);

      edgeLinesRef.current.forEach((line, edge) => {
        if (edgeSet.has(edge)) return;
        scene.remove(line);
        line.geometry.dispose();
        (line.material as Material).dispose();
        edgeLinesRef.current.delete(edge);
      });

      currentEdges.forEach((edge) => {
        let line = edgeLinesRef.current.get(edge);
        const points = [
          new Vector3(edge.n1.x, 0, edge.n1.y),
          new Vector3(edge.n2.x, 0, edge.n2.y),
        ];

        if (!line) {
          const geometry = new BufferGeometry().setFromPoints(points);
          const material = new LineDashedMaterial({
            color: 0xffffff,
            dashSize: 2,
            gapSize: 1,
          });
          line = new Line(geometry, material);
          line.computeLineDistances();
          line.userData.edge = edge;
          scene.add(line);
          edgeLinesRef.current.set(edge, line);
        } else {
          const geometry = line.geometry as BufferGeometry;
          geometry.setFromPoints(points);
          const position = geometry.attributes.position;
          if (position) position.needsUpdate = true;
          line.computeLineDistances();
        }
      });

      setNodeCount(currentNodes.length);
      setEdgeCount(currentEdges.length);
      setNodes(currentNodes);
      setEdges(currentEdges);
      setSelected(graph.getSelected());
      setHovered(graph.getHovered());
    },
    [scene]
  );

  const updatePointer = useCallback(
    (evt: PointerEvent) => {
      const rect = dom.getBoundingClientRect();
      pointerRef.current.x = ((evt.clientX - rect.left) / rect.width) * 2 - 1;
      pointerRef.current.y = -((evt.clientY - rect.top) / rect.height) * 2 + 1;
      raycasterRef.current.setFromCamera(pointerRef.current, camera);
    },
    [camera, dom]
  );

  const pickIntersection = useCallback(() => {
    const meshes = Array.from(nodeMeshesRef.current.values());
    return raycasterRef.current.intersectObjects(meshes, false)[0];
  }, []);

  useEffect(() => {
    if (!dom) return;

    const graphEditor = new GraphEditor({
      onChange: () => syncVisuals(graphEditor),
    });
    editorRef.current = graphEditor;
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
      setNodes([]);
      setEdges([]);
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
