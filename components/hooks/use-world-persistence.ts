import { Graph } from "@/lib/primitives/graph";
import { World } from "@/lib/world";
import { RefObject } from "react";

export function useWorldPersistence(
  worldRef: RefObject<World | null>,
  graphRef: RefObject<Graph | null>,
) {
  const saveToJson = () => {
    const world = worldRef.current;
    if (!world) return;

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
      reader.onload = (ev: ProgressEvent<FileReader>) => {
        try {
          const text = ev.target?.result as string;
          const parsed = JSON.parse(text);
          const world = worldRef.current;
          if (!world) return;

          world.fromJson(parsed);
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
