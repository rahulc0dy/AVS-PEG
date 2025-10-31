"use client";

import { useEffect, useRef, useState } from "react";
import {
  Scene,
  PerspectiveCamera,
  WebGLRenderer,
  SphereGeometry,
  MeshBasicMaterial,
  Mesh,
  LineBasicMaterial,
  BufferGeometry,
  Line,
  Vector3,
  Raycaster,
  Vector2,
  Plane,
  Color,
  GridHelper,
} from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

type Node3D = {
  id: number;
  position: Vector3;
  mesh: Mesh<SphereGeometry, MeshBasicMaterial>;
};

type Edge3D = {
  id: number;
  start: Node3D;
  end: Node3D;
  line: Line<BufferGeometry, LineBasicMaterial>;
};

export default function GraphEditor() {
  const mountRef = useRef<HTMLDivElement>(null);

  // UI state only (counts/labels); the authoritative data lives in refs for stable event handlers
  const [nodeCount, setNodeCount] = useState(0);
  const [edgeCount, setEdgeCount] = useState(0);

  // Scene refs
  const sceneRef = useRef<Scene | null>(null);
  const cameraRef = useRef<PerspectiveCamera | null>(null);
  const rendererRef = useRef<WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const raycasterRef = useRef<Raycaster>(new Raycaster());
  const mouseRef = useRef<Vector2>(new Vector2());

  // Data refs
  const nodesRef = useRef<Node3D[]>([]);
  const edgesRef = useRef<Edge3D[]>([]);
  // Previous node for chaining connections
  const prevRef = useRef<Node3D | null>(null);
  // Hovered node for intent preview/highlight
  const hoverRef = useRef<Node3D | null>(null);
  // Preview (ghost) line showing potential connection
  const previewLineRef = useRef<Line<BufferGeometry, LineBasicMaterial> | null>(
    null
  );
  // Dragging state
  const downNodeRef = useRef<Node3D | null>(null);
  const isDraggingRef = useRef<boolean>(false);
  const dragOffsetRef = useRef<Vector3 | null>(null);
  const downClientRef = useRef<{ x: number; y: number } | null>(null);
  const downStartedOnEmptyRef = useRef<boolean>(false);
  const dragThresholdSq = 9; // 3px squared

  useEffect(() => {
    if (!mountRef.current) return;

    // Scene
    const scene = new Scene();
    scene.background = new Color(0x0b0b0f);
    sceneRef.current = scene;

    // Camera
    const camera = new PerspectiveCamera(
      60,
      mountRef.current.clientWidth / mountRef.current.clientHeight,
      0.1,
      1000
    );
    camera.position.set(0, 5, 12);
    cameraRef.current = camera;

    // Renderer
    const renderer = new WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(
      mountRef.current.clientWidth,
      mountRef.current.clientHeight
    );
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.target.set(0, 0, 0);
    controlsRef.current = controls;

    // Helpers
    const grid = new GridHelper(100, 100, 0x333333, 0x1a1a1a);
    scene.add(grid);

    // Ground plane (math) for intersection at y = 0
    const groundPlane = new Plane(new Vector3(0, 1, 0), 0);

    // Pointer conversion helper
    const updateMouseNDC = (e: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouseRef.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouseRef.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    };

    // Add a node
    const setNodeColor = (node: Node3D, hex: number) => {
      (node.mesh.material as MeshBasicMaterial).color.setHex(hex);
    };

    const addNode = (position: Vector3) => {
      const geometry = new SphereGeometry(0.3, 16, 16);
      const material = new MeshBasicMaterial({ color: 0x2ecc71 });
      const mesh = new Mesh(geometry, material);
      mesh.position.copy(position);

      const node: Node3D = {
        id: Date.now() + Math.random(),
        // Keep position reference in sync with mesh
        position: mesh.position,
        mesh,
      };
      nodesRef.current.push(node);
      scene.add(mesh);
      setNodeCount(nodesRef.current.length);
      return node;
    };

    // Add an edge
    const addEdge = (a: Node3D, b: Node3D) => {
      const geometry = new BufferGeometry().setFromPoints([
        a.position.clone(),
        b.position.clone(),
      ]);
      const material = new LineBasicMaterial({ color: 0x3498db });
      const line = new Line(geometry, material);
      const edge: Edge3D = {
        id: Date.now() + Math.random(),
        start: a,
        end: b,
        line,
      };
      edgesRef.current.push(edge);
      scene.add(line);
      setEdgeCount(edgesRef.current.length);
      return edge;
    };

    const clearPrevSelection = () => {
      if (prevRef.current) setNodeColor(prevRef.current, 0x2ecc71);
      prevRef.current = null;
      // Also hide preview if visible
      if (
        previewLineRef.current &&
        scene.children.includes(previewLineRef.current)
      ) {
        scene.remove(previewLineRef.current);
      }
    };

    const chainConnectOnClick = (node: Node3D) => {
      // If dragging occurred, we don't treat it as a click
      if (isDraggingRef.current) return;
      if (!prevRef.current) {
        prevRef.current = node;
        setNodeColor(node, 0xe74c3c);
        return;
      }
      if (prevRef.current !== node) {
        const last = prevRef.current;
        // Restore color of last
        setNodeColor(last, 0x2ecc71);
        // Add edge and advance chaining head to the clicked node
        addEdge(last, node);
        prevRef.current = node;
        setNodeColor(node, 0xe74c3c);
      }
    };

    const updateEdgesForNode = (node: Node3D) => {
      edgesRef.current.forEach((e) => {
        if (e.start === node || e.end === node) {
          e.line.geometry.setFromPoints([
            e.start.position.clone(),
            e.end.position.clone(),
          ]);
        }
      });
    };

    const ensurePreviewLine = () => {
      if (!previewLineRef.current) {
        previewLineRef.current = new Line(
          new BufferGeometry(),
          new LineBasicMaterial({
            color: 0xf1c40f,
            transparent: true,
            opacity: 0.7,
          })
        );
      }
      if (!scene.children.includes(previewLineRef.current)) {
        scene.add(previewLineRef.current);
      }
    };

    const hidePreviewLine = () => {
      if (
        previewLineRef.current &&
        scene.children.includes(previewLineRef.current)
      ) {
        scene.remove(previewLineRef.current);
      }
    };

    const updateHover = (node: Node3D | null) => {
      if (hoverRef.current && hoverRef.current !== prevRef.current) {
        setNodeColor(hoverRef.current, 0x2ecc71);
      }
      hoverRef.current = node;
      if (hoverRef.current && hoverRef.current !== prevRef.current) {
        setNodeColor(hoverRef.current, 0xf39c12);
      }
      // Preview from prev to hover
      if (prevRef.current && node && node !== prevRef.current) {
        ensurePreviewLine();
        previewLineRef.current!.geometry.setFromPoints([
          prevRef.current.position.clone(),
          node.position.clone(),
        ]);
      } else {
        hidePreviewLine();
      }
    };

    // Event handlers
    const onPointerDown = (e: MouseEvent) => {
      updateMouseNDC(e);
      raycasterRef.current.setFromCamera(mouseRef.current, camera);

      // Try hit node meshes first
      const intersects = raycasterRef.current.intersectObjects(
        nodesRef.current.map((n) => n.mesh),
        false
      );

      if (intersects.length > 0) {
        const mesh = intersects[0].object as Mesh;
        const node = nodesRef.current.find((n) => n.mesh === mesh);
        if (node) {
          if (e.button === 0) {
            // Prepare for possible drag or click-chain
            downNodeRef.current = node;
            isDraggingRef.current = false;
            downClientRef.current = { x: e.clientX, y: e.clientY };
            // Prepare drag offset
            const hit = new Vector3();
            const groundPlane = new Plane(new Vector3(0, 1, 0), 0);
            if (raycasterRef.current.ray.intersectPlane(groundPlane, hit)) {
              dragOffsetRef.current = node.position.clone().sub(hit);
            } else {
              dragOffsetRef.current = new Vector3();
            }
          } else if (e.button === 2) {
            // Right-click on node: delete
            e.preventDefault();
            deleteNode(node);
          }
          return;
        }
      }

      // Otherwise, start potential empty-area click (defer creation to pointerup)
      if (e.button === 0) {
        downStartedOnEmptyRef.current = true;
        isDraggingRef.current = false;
        downClientRef.current = { x: e.clientX, y: e.clientY };
      }
    };

    const onPointerMove = (e: MouseEvent) => {
      updateMouseNDC(e);
      raycasterRef.current.setFromCamera(mouseRef.current, camera);

      // Hover detection
      const intersects = raycasterRef.current.intersectObjects(
        nodesRef.current.map((n) => n.mesh),
        false
      );
      const hoveredMesh = intersects[0]?.object as Mesh | undefined;
      const hoveredNode = hoveredMesh
        ? nodesRef.current.find((n) => n.mesh === hoveredMesh) || null
        : null;
      updateHover(hoveredNode);

      // Drag threshold and movement
      if (downNodeRef.current && (e.buttons & 1) === 1) {
        const down = downClientRef.current;
        if (down && !isDraggingRef.current) {
          const dx = e.clientX - down.x;
          const dy = e.clientY - down.y;
          if (dx * dx + dy * dy > dragThresholdSq) {
            isDraggingRef.current = true;
            controls.enabled = false;
          }
        }
        if (isDraggingRef.current) {
          const groundPlane = new Plane(new Vector3(0, 1, 0), 0);
          const hit = new Vector3();
          if (raycasterRef.current.ray.intersectPlane(groundPlane, hit)) {
            const offset = dragOffsetRef.current || new Vector3();
            const node = downNodeRef.current;
            node.mesh.position.copy(hit.clone().add(offset));
            node.position = node.mesh.position; // keep ref
            updateEdgesForNode(node);
            // Update preview if dragging the prev node
            if (prevRef.current && hoverRef.current && previewLineRef.current) {
              if (prevRef.current === node) {
                previewLineRef.current.geometry.setFromPoints([
                  node.position.clone(),
                  hoverRef.current.position.clone(),
                ]);
              }
            }
          }
        }
      }

      // Empty-area drag threshold to avoid accidental node creation during orbit
      if (downStartedOnEmptyRef.current && (e.buttons & 1) === 1) {
        const down = downClientRef.current;
        if (down && !isDraggingRef.current) {
          const dx = e.clientX - down.x;
          const dy = e.clientY - down.y;
          if (dx * dx + dy * dy > dragThresholdSq) {
            isDraggingRef.current = true;
            // Keep controls enabled for orbiting
          }
        }
      }

      // If hovering empty and have a prev node, show preview to ground point
      if (prevRef.current && !hoveredNode) {
        const groundPlane = new Plane(new Vector3(0, 1, 0), 0);
        const hit = new Vector3();
        if (raycasterRef.current.ray.intersectPlane(groundPlane, hit)) {
          ensurePreviewLine();
          previewLineRef.current!.geometry.setFromPoints([
            prevRef.current.position.clone(),
            hit.clone(),
          ]);
        }
      }
    };

    const onPointerUp = (e: MouseEvent) => {
      if (downNodeRef.current && e.button === 0) {
        if (!isDraggingRef.current) {
          chainConnectOnClick(downNodeRef.current);
        }
      }
      // If started on empty and not dragging, add node now (click)
      if (
        downStartedOnEmptyRef.current &&
        e.button === 0 &&
        !isDraggingRef.current
      ) {
        updateMouseNDC(e);
        raycasterRef.current.setFromCamera(mouseRef.current, camera);
        const groundPlane = new Plane(new Vector3(0, 1, 0), 0);
        const hit = new Vector3();
        if (raycasterRef.current.ray.intersectPlane(groundPlane, hit)) {
          const newNode = addNode(hit);
          if (prevRef.current) {
            // connect and advance
            const last = prevRef.current;
            setNodeColor(last, 0x2ecc71);
            addEdge(last, newNode);
            prevRef.current = newNode;
            setNodeColor(newNode, 0xe74c3c);
          } else {
            // start chaining on first node
            prevRef.current = newNode;
            setNodeColor(newNode, 0xe74c3c);
          }
        }
      }
      // Reset drag state
      if (isDraggingRef.current) {
        controls.enabled = true;
      }
      isDraggingRef.current = false;
      downNodeRef.current = null;
      dragOffsetRef.current = null;
      downClientRef.current = null;
      downStartedOnEmptyRef.current = false;
    };

    const deleteNode = (node: Node3D) => {
      // Remove connected edges
      const remaining: Edge3D[] = [];
      edgesRef.current.forEach((e) => {
        if (e.start === node || e.end === node) {
          scene.remove(e.line);
          e.line.geometry.dispose();
          e.line.material.dispose();
        } else {
          remaining.push(e);
        }
      });
      edgesRef.current = remaining;
      setEdgeCount(edgesRef.current.length);

      // Remove node
      scene.remove(node.mesh);
      node.mesh.geometry.dispose();
      node.mesh.material.dispose();
      nodesRef.current = nodesRef.current.filter((n) => n !== node);
      setNodeCount(nodesRef.current.length);

      // Clear selection/hover if needed
      if (prevRef.current === node) {
        prevRef.current = null;
        hidePreviewLine();
      }
      if (hoverRef.current === node) hoverRef.current = null;
    };

    const onContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      updateMouseNDC(e);
      raycasterRef.current.setFromCamera(mouseRef.current, camera);
      const intersects = raycasterRef.current.intersectObjects(
        nodesRef.current.map((n) => n.mesh),
        false
      );
      const mesh = intersects[0]?.object as Mesh | undefined;
      if (mesh) {
        const node = nodesRef.current.find((n) => n.mesh === mesh);
        if (node) deleteNode(node);
      } else {
        // Right-click empty: stop chaining
        clearPrevSelection();
      }
    };

    const onResize = () => {
      if (!mountRef.current || !rendererRef.current || !cameraRef.current)
        return;
      const w = mountRef.current.clientWidth;
      const h = mountRef.current.clientHeight;
      rendererRef.current.setSize(w, h);
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
    };

    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    renderer.domElement.addEventListener("pointermove", onPointerMove);
    renderer.domElement.addEventListener("pointerup", onPointerUp);
    renderer.domElement.addEventListener("contextmenu", onContextMenu);
    window.addEventListener("resize", onResize);

    // Animate
    const animate = () => {
      controls.update();
      renderer.render(scene, camera);
    };
    renderer.setAnimationLoop(animate);

    // Cleanup
    return () => {
      renderer.setAnimationLoop(null);
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      renderer.domElement.removeEventListener("pointermove", onPointerMove);
      renderer.domElement.removeEventListener("pointerup", onPointerUp);
      renderer.domElement.removeEventListener("contextmenu", onContextMenu);
      window.removeEventListener("resize", onResize);

      // Dispose scene objects
      edgesRef.current.forEach((e) => {
        e.line.geometry.dispose();
        e.line.material.dispose();
        scene.remove(e.line);
      });
      nodesRef.current.forEach((n) => {
        n.mesh.geometry.dispose();
        n.mesh.material.dispose();
        scene.remove(n.mesh);
      });
      edgesRef.current = [];
      nodesRef.current = [];
      prevRef.current = null;
      hoverRef.current = null;
      if (previewLineRef.current) {
        scene.remove(previewLineRef.current);
        previewLineRef.current.geometry.dispose();
        previewLineRef.current.material.dispose();
        previewLineRef.current = null;
      }

      controls.dispose();
      mountRef.current?.removeChild(renderer.domElement);
      renderer.dispose();
    };
  }, []);

  return (
    <div style={{ width: "100vw", height: "100vh", position: "relative" }}>
      <div ref={mountRef} style={{ width: "100%", height: "100%" }} />
      <div
        style={{
          position: "absolute",
          top: 10,
          left: 10,
          color: "#eaeaea",
          background: "rgba(0,0,0,0.45)",
          padding: "8px 10px",
          borderRadius: 6,
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Arial, 'Apple Color Emoji', 'Segoe UI Emoji'",
          fontSize: 13,
          lineHeight: 1.4,
          pointerEvents: "none",
        }}>
        <div>
          <strong>Graph Editor</strong>
        </div>
        <div>
          Nodes: {nodeCount} • Edges: {edgeCount}
        </div>
        <div>Left-click empty space: add node</div>
        <div>Left-click node twice: connect nodes</div>
        <div>Drag to orbit • Scroll to zoom</div>
      </div>
    </div>
  );
}
