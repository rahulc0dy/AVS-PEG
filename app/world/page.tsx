"use client";

import { GraphEditor } from "@/lib/editors/graphEditor";
import { setupScene } from "@/utils/rendering";
import { useEffect, useRef, useState } from "react";

export default function CarPage() {
  const mountRef = useRef<HTMLDivElement>(null);
  const [nodeCount, setNodeCount] = useState(0);
  const [edgeCount, setEdgeCount] = useState(0);

  useEffect(() => {
    if (!mountRef.current) return;
    const mount = mountRef.current;

    const { scene, camera, renderer } = setupScene(mount, {
      cameraPosition: {
        x: 0,
        y: 60,
        z: 120,
      },
    });

    const editor = new GraphEditor({
      scene,
      camera,
      dom: renderer.domElement,
      onChange: (nodes, edges) => {
        setNodeCount(nodes);
        setEdgeCount(edges);
      },
    });

    editor.enable();

    return () => {
      renderer.setAnimationLoop(null);

      editor.dispose();

      mount?.removeChild(renderer.domElement);
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
        }}
      >
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
