import { GraphEditor } from "@/lib/editors/graph-editor";
import { TrafficLightEditor } from "@/lib/editors/traffic-light-editor";
import { Graph } from "@/lib/primitives/graph";
import { World } from "@/lib/world";
import { RefObject, useEffect, useRef } from "react";
import { OrbitControls } from "three/examples/jsm/Addons.js";

/**
 * Hook that drives the main world animation loop.
 *
 * Responsibilities:
 * - Updates `OrbitControls` each frame so damping and interactions are applied.
 * - Calls editor `draw()` methods (graph & traffic-light editors); if they
 *   indicate visual changes the world will be redrawn.
 * - Detects structural changes on `graph` via `graph.getChanges()` and when
 *   detected runs `world.generate()` followed by `world.draw()` to rebuild
 *   derived geometry (roads, borders, etc.).
 * - Advances simulation each frame by calling `world.update()`.
 *
 * Note: This hook schedules a requestAnimationFrame loop and cancels it on
 * cleanup.
 *
 * @param controlsRef - Ref to `OrbitControls` used to update control state each frame.
 * @param graphEditorRef - Ref to the `GraphEditor` instance; used to draw editor overlays and detect editor-driven visual changes.
 * @param trafficLightEditorRef - Ref to the `TrafficLightEditor`; updated with world edges after generation.
 * @param worldRef - Ref to the `World` instance which is generated, drawn and updated.
 * @param graphRef - Ref to the `Graph` data structure that drives world generation; `graph.getChanges()` is used to detect structural modifications.
 */
export function useWorldAnimation(
  controlsRef: RefObject<OrbitControls | null>,
  graphEditorRef: RefObject<GraphEditor | null>,
  trafficLightEditorRef: RefObject<TrafficLightEditor | null>,
  worldRef: RefObject<World | null>,
  graphRef: RefObject<Graph | null>,
) {
  // Ref to store the active requestAnimationFrame id so we can cancel it on cleanup.
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    // Tracks the last observed graph change counter so we can detect structural
    // changes to the graph and regenerate the world's derived geometry.
    let previousGraphChanges = -1;

    // Mounted flag prevents scheduling frames after the component unmounts.
    let mounted = true;

    const animate = () => {
      // If unmounted, do not schedule or perform any work.
      if (!mounted) return;

      // Schedule the next frame and remember the id for cancellation later.
      frameRef.current = requestAnimationFrame(animate);

      controlsRef.current?.update();

      const gEditor = graphEditorRef.current;
      const tlEditor = trafficLightEditorRef.current;
      const world = worldRef.current;
      const graph = graphRef.current;

      // Editors may draw overlays/handles; `draw()` returns true when visuals
      // changed and a world redraw is desirable.
      const editorChanged =
        (gEditor?.draw() ?? false) || (tlEditor?.draw() ?? false);

      // If required runtime objects are missing, skip this frame's logic.
      if (!world || !graph) {
        return;
      }

      // Detect structural changes in the graph. When the change counter differs
      // we must regenerate derived world geometry (roads, borders, etc.).
      const changes = graph.getChanges();

      if (changes !== previousGraphChanges) {
        // Rebuild derived geometry from the updated graph.
        world.generate();
        previousGraphChanges = changes;

        world.draw();

        // Update traffic-light editor with any new target edges from the world.
        if (tlEditor) {
          tlEditor.targetEdges = world.roadBorders;
        }

        return;
      }

      // If editors changed visuals (handles/guides), redraw the world so
      // overlay composition is correct.
      if (editorChanged) {
        world.draw();
      }

      // Advance simulation: move cars, update animations, etc.
      world.update();
    };

    animate();

    // Cleanup: stop scheduling frames and cancel any pending rAF.
    return () => {
      mounted = false;
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [controlsRef, graphEditorRef, trafficLightEditorRef, worldRef, graphRef]);
}
