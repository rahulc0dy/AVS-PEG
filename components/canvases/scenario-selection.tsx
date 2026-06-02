"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ScenarioEntry, ScenarioManifest } from "@/types/scenario";
import Button from "@/components/ui/button";

/** Colour palette for difficulty badges. */
const DIFFICULTY_COLORS: Record<string, string> = {
  easy: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  medium: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  hard: "bg-rose-500/15 text-rose-400 border-rose-500/30",
};

/** Decorative icons per difficulty tier. */
const DIFFICULTY_ICONS: Record<string, string> = {
  easy: "●",
  medium: "●●",
  hard: "●●●",
};

interface ScenarioSelectionProps {
  /** Invoked when the user selects a scenario. */
  onSelectScenario: (scenario: ScenarioEntry) => void;
  /** Invoked when the user chooses to load a custom world via file picker. */
  onLoadCustom: () => void;
}

/**
 * Scenario selection screen displayed when the user navigates to `/simulate`.
 *
 * Fetches the scenario manifest from `public/scenarios/scenario-manifest.json`,
 * renders a searchable grid of scenario cards, and allows loading a custom
 * world file as a fallback.
 */
export default function ScenarioSelection({
  onSelectScenario,
  onLoadCustom,
}: ScenarioSelectionProps) {
  const [scenarios, setScenarios] = useState<ScenarioEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/scenarios/scenario-manifest.json");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const manifest: ScenarioManifest = await res.json();
        if (!cancelled) {
          setScenarios(manifest.scenarios);
          setLoading(false);
        }
      } catch (err) {
        console.error("Failed to load scenario manifest:", err);
        if (!cancelled) {
          setError("Could not load scenarios.");
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /** Filter scenarios by search query matching name, description, or tags. */
  const filtered = useMemo(() => {
    if (!search.trim()) return scenarios;
    const q = search.toLowerCase();
    return scenarios.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.tags?.some((t) => t.toLowerCase().includes(q)),
    );
  }, [scenarios, search]);

  const handleSelect = useCallback(
    (scenario: ScenarioEntry) => {
      onSelectScenario(scenario);
    },
    [onSelectScenario],
  );

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center overflow-auto bg-zinc-950/95 backdrop-blur-md">
      <div className="w-full max-w-4xl px-6 py-12">
        {/* Header */}
        <div className="mb-10 text-center">
          <h1 className="mb-2 bg-gradient-to-b from-white to-zinc-400 bg-clip-text text-4xl font-extrabold tracking-tight text-transparent md:text-5xl">
            Simulation Scenarios
          </h1>
          <p className="mx-auto max-w-xl text-sm text-zinc-500">
            Select a scenario to run the simulation. Each scenario loads a
            pre-built world and drives AI cars using a shared trained brain.
          </p>
        </div>

        {/* Search + Custom load */}
        <div className="mb-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
          <div className="relative w-full max-w-xs">
            <svg
              className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-zinc-500"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <input
              type="text"
              placeholder="Search scenarios…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 w-full rounded-lg border border-zinc-700/60 bg-zinc-800/80 pr-3 pl-9 text-xs text-zinc-200 placeholder-zinc-600 outline-none transition-colors focus:border-zinc-500"
            />
          </div>
          <Button variant="outline" size="sm" onClick={onLoadCustom}>
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="shrink-0"
            >
              <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
            Load Custom World
          </Button>
        </div>

        {/* Loading / Error */}
        {loading && (
          <div className="flex justify-center py-20">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-600 border-t-zinc-300" />
          </div>
        )}
        {error && (
          <div className="py-20 text-center text-sm text-rose-400">{error}</div>
        )}

        {/* Scenario Grid */}
        {!loading && !error && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((scenario) => (
              <button
                key={scenario.id}
                type="button"
                onClick={() => handleSelect(scenario)}
                className="group relative cursor-pointer overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 text-left transition-all duration-200 hover:border-teal-500/50 hover:bg-zinc-900 hover:shadow-[0_0_30px_-5px_rgba(20,184,166,0.15)]"
              >
                {/* Difficulty badge */}
                {scenario.difficulty && (
                  <span
                    className={`absolute top-4 right-4 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${DIFFICULTY_COLORS[scenario.difficulty] ?? "bg-zinc-700/30 text-zinc-400 border-zinc-600"}`}
                  >
                    {DIFFICULTY_ICONS[scenario.difficulty]}{" "}
                    {scenario.difficulty}
                  </span>
                )}

                {/* Title */}
                <h3 className="mb-2 text-base font-bold text-zinc-100 transition-colors group-hover:text-teal-300">
                  {scenario.name}
                </h3>

                {/* Description */}
                <p className="mb-4 text-xs leading-relaxed text-zinc-500">
                  {scenario.description}
                </p>

                {/* Tags */}
                {scenario.tags && scenario.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {scenario.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-md bg-zinc-800/80 px-2 py-0.5 text-[10px] text-zinc-500"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </button>
            ))}

            {filtered.length === 0 && (
              <div className="col-span-full py-12 text-center text-sm text-zinc-600">
                No scenarios match your search.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
