"use client";

import {
  createContext,
  useContext,
  useRef,
  useEffect,
  useState,
  ReactNode,
} from "react";
import {
  Scene,
  PerspectiveCamera,
  WebGLRenderer,
  Color,
  GridHelper,
  AmbientLight,
  DirectionalLight,
} from "three";
import { Graph } from "@/utils/graph";
import { createRoadGroup } from "@/utils/graph/roadVisual";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import Stats from "three/examples/jsm/libs/stats.module.js";

type SceneContextType = Scene | null;
const SceneContext = createContext<SceneContextType>(null);

export const useScene = () => useContext(SceneContext);

export const CarSceneProvider = ({ children }: { children: ReactNode }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [scene, setScene] = useState<Scene | null>(null);

  useEffect(() => {
    if (!mountRef.current) return;
    const mount = mountRef.current;

    const stats = new Stats();
    mount.appendChild(stats.dom);

    const newScene = new Scene();
    newScene.background = new Color(0x0b0b0f);
    setScene(newScene);

    // Add lighting
    const ambientLight = new AmbientLight(0xffffff, 0.6);
    newScene.add(ambientLight);

    const directionalLight = new DirectionalLight(0xffffff, 1);
    directionalLight.position.set(5, 10, 7.5);
    newScene.add(directionalLight);

    const camera = new PerspectiveCamera(
      75,
      mount.clientWidth / mount.clientHeight,
      0.1,
      1000
    );
    camera.position.set(10, 10, 10);

    const renderer = new WebGLRenderer({ antialias: true });
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    mount.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    const grid = new GridHelper(100, 100, 0x333333, 0x1a1a1a);
    newScene.add(grid);

    // Road visuals: try to load the real graph from localStorage (used by /editor)
    let roadGroupName = "road-group";
    let currentRoadGroup: any = null;

    const disposeRoadGroup = (group: any) => {
      try {
        if (!group) return;
        group.children.forEach((child: any) => {
          // Mesh
          if (child.geometry) {
            try {
              child.geometry.dispose();
            } catch {}
          }
          if (child.material) {
            try {
              child.material.dispose();
            } catch {}
          }
        });
        newScene.remove(group);
      } catch (err) {
        // ignore
      }
    };

    const addRoadGroupFromSnapshot = (raw: string | null) => {
      disposeRoadGroup(currentRoadGroup);
      try {
        if (raw) {
          const parsed = JSON.parse(raw);
          const snapshot = parsed && parsed.snapshot ? parsed.snapshot : parsed;
          const graph = new Graph(snapshot);
          const g = createRoadGroup(graph, { roadWidth: 8, laneLine: true });
          g.name = roadGroupName;
          newScene.add(g);
          currentRoadGroup = g;
          return;
        }
      } catch (err) {
        // fall through to demo
      }
      return;
    };

    // Initialize from localStorage key used by the editor
    const storageKey = "graph_snapshot";
    try {
      const raw = localStorage.getItem(storageKey);
      addRoadGroupFromSnapshot(raw);
    } catch (err) {
      addRoadGroupFromSnapshot(null);
    }

    // Update when storage changes (e.g. editor saves in another tab)
    const onStorage = (e: StorageEvent) => {
      if (e.key === storageKey) {
        addRoadGroupFromSnapshot(e.newValue);
      }
    };
    window.addEventListener("storage", onStorage);

    const onResize = () => {
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    };
    window.addEventListener("resize", onResize);

    const animate = () => {
      stats.update();
      controls.update();
      renderer.render(newScene, camera);
    };
    renderer.setAnimationLoop(animate);

    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("storage", onStorage);
      renderer.setAnimationLoop(null);
      if (mount) {
        mount.removeChild(renderer.domElement);
        mount.removeChild(stats.dom);
      }
      try {
        disposeRoadGroup(currentRoadGroup);
      } catch {}
      controls.dispose();
    };
  }, []);

  return (
    <SceneContext.Provider value={scene}>
      <div ref={mountRef} style={{ width: "100vw", height: "100vh" }} />
      {children}
    </SceneContext.Provider>
  );
};
