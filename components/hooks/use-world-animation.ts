import { GraphEditor } from "@/lib/editors/graph-editor";
import { TrafficLightEditor } from "@/lib/editors/traffic-light-editor";
import { Graph } from "@/lib/primitives/graph";
import { World } from "@/lib/world";
import { RefObject, useEffect, useRef } from "react";
import { OrbitControls } from "three/examples/jsm/Addons.js";

export function useWorldAnimation(
  controlsRef: RefObject<OrbitControls | null>,
  graphEditorRef: RefObject<GraphEditor | null>,
  trafficLightEditorRef: RefObject<TrafficLightEditor | null>,
  worldRef: RefObject<World | null>,
  graphRef: RefObject<Graph | null>,
) {
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    let previousGraphChanges = -1;
    let mounted = true;

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

      if (changes !== previousGraphChanges) {
        world.generate();
        previousGraphChanges = changes;
        world.draw();
        if (tlEditor) {
          tlEditor.targetEdges = world.roadBorders;
        }
        return;
      }

      if (editorChanged) {
        world.draw();
      }

      world.update();
    };

    animate();

    return () => {
      mounted = false;
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [controlsRef, graphEditorRef, trafficLightEditorRef, worldRef, graphRef]);
}
