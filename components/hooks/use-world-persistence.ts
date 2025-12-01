import { Graph } from "@/lib/primitives/graph";
import { World } from "@/lib/world";
import { RefObject } from "react";

/**
 * Hook providing simple JSON persistence helpers for the world and graph.
 *
 * `saveToJson` serializes the current `World` to a downloadable JSON file.
 * `loadFromJson` opens a file picker, parses a selected JSON file, and
 * loads it into the current `World` instance (updating the `graphRef`).
 *
 * @param {import("react").RefObject<World | null>} worldRef - Ref to the current World instance.
 * @param {import("react").RefObject<Graph | null>} graphRef - Ref to the current Graph instance; updated after loading.
 * @returns {{ saveToJson: () => void, loadFromJson: () => void }} Persistence helper functions.
 */
export function useWorldPersistence(
  worldRef: RefObject<World | null>,
  graphRef: RefObject<Graph | null>,
) {
  const saveToJson = () => {
    const world = worldRef.current;
    if (!world) return;
    // Serialize the world to JSON and trigger a download via an anchor element.
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
      // Load file contents and parse JSON to populate the current World.
      // We update the `graphRef` reference to the world's graph so callers
      // have the latest graph object, then redraw the world.
      reader.onload = (ev: ProgressEvent<FileReader>) => {
        try {
          const text = ev.target?.result as string;
          const parsed = JSON.parse(text);
          const world = worldRef.current;
          if (!world) return;

          world.fromJson(parsed);
          // Keep external graphRef in sync with the loaded world's graph.
          graphRef.current = world.graph;
          world.draw();
        } catch (err) {
          console.error("Failed to load world JSON:", err);
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  return { saveToJson, loadFromJson };
}
