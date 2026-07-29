/**
 * Index of all available simulation scenarios.
 *
 * Loaded from `public/scenarios/scenario-manifest.json` at runtime.
 */
export interface ScenarioManifest {
  scenarios: ScenarioEntry[];
}

/**
 * Metadata for a single simulation scenario.
 */
export interface ScenarioEntry {
  /** Unique identifier used as a slug/key. */
  id: string;
  /** Human-readable display name. */
  name: string;
  /** Short description of the scenario. */
  description: string;
  /** Path to the world JSON file relative to the public root (e.g. "/scenarios/straight-road.json"). */
  worldPath: string;
  /** Difficulty/complexity tag. */
  difficulty?: "easy" | "medium" | "hard";
  /** Tags for filtering (e.g. ["traffic-lights", "roundabout"]). */
  tags?: string[];
}
