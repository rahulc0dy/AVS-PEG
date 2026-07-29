import { World } from "@/lib/world/world";
import { RefObject } from "react";
import { useToast } from "@/components/ui/toast";
import { WorldJson } from "@/types/save";
import { NeuralNetworkJson } from "@/types/save";

/**
 * Hook providing JSON persistence helpers for the world.
 *
 * `saveToJson` serializes the current `World` to a downloadable JSON file.
 * `loadFromJson` opens a file picker, parses a selected JSON file, and
 * loads it into the current `World` instance.
 * `loadWorldFromUrl` fetches a world JSON from a URL and loads it.
 * `fetchBrain` fetches a `NeuralNetworkJson` from a URL.
 *
 * @param worldRef - Ref to the current World instance.
 * @returns Persistence helper functions.
 */
export function useWorldPersistence(worldRef: RefObject<World | null>) {
  const { toast } = useToast();

  /**
   * Serializes the current world to JSON and triggers a file download.
   */
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
    toast("World saved to file.", "success");
  };

  /**
   * Opens a file picker and loads a JSON file into the current world.
   */
  const loadFromJson = (onLoad?: () => void) => {
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
          world.draw();
          toast("World loaded successfully.", "success");

          if (typeof onLoad === "function") onLoad();
        } catch (err) {
          console.error("Failed to load world JSON:", err);
          toast("Failed to load world file.", "error");
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  /**
   * Fetch a world JSON from a URL and load it into the current world.
   *
   * Uses the standard `fetch` API to retrieve a `WorldJson` from a public
   * path (e.g. `/scenarios/straight-road.json`) and deserializes it via
   * `world.fromJson()`.
   *
   * @param url - URL path to the world JSON file.
   * @param onLoad - Optional callback invoked after successful load.
   */
  const loadWorldFromUrl = async (
    url: string,
    onLoad?: () => void,
  ): Promise<void> => {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const parsed: WorldJson = await response.json();
      const world = worldRef.current;
      if (!world) {
        toast("World not ready yet.", "error");
        return;
      }

      world.fromJson(parsed);
      world.draw();
      toast("World loaded successfully.", "success");

      if (typeof onLoad === "function") onLoad();
    } catch (err) {
      console.error("Failed to load world from URL:", err);
      toast("Failed to load world from URL.", "error");
    }
  };

  /**
   * Fetch a `NeuralNetworkJson` brain from a URL.
   *
   * @param url - URL path to the brain JSON file (defaults to `/brain.json`).
   * @returns Parsed `NeuralNetworkJson`, or `null` if the fetch fails.
   */
  const fetchBrain = async (
    url: string = "/brain.json",
  ): Promise<NeuralNetworkJson | null> => {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        console.warn(`Brain fetch failed: HTTP ${response.status}`);
        return null;
      }
      const brainJson: NeuralNetworkJson = await response.json();
      if (!brainJson.levels || !Array.isArray(brainJson.levels)) {
        console.warn("Invalid brain file format.");
        return null;
      }
      return brainJson;
    } catch (err) {
      console.warn("Failed to fetch brain:", err);
      return null;
    }
  };

  return { saveToJson, loadFromJson, loadWorldFromUrl, fetchBrain };
}
