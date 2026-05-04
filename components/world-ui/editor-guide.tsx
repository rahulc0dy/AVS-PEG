"use client";

import { useState } from "react";
import { EditorMode } from "@/types/editor";
import { GraphEdgeType, SourceDestinationMarkingType } from "@/types/marking";

/**
 * Data structure describing a single editor mode's guide content.
 */
interface ModeGuideData {
  title: string;
  description: string;
  controls: { keys: string[]; action: string }[];
  tip?: string;
}

/**
 * Props for the EditorGuide component.
 */
interface EditorGuideProps {
  /** Currently active editor mode. */
  activeMode: EditorMode;
  /** Current graph edge type (one-way vs two-way). */
  graphRoadType?: GraphEdgeType;
  /** Current source/destination marking sub-type. */
  sourceDestMarkingType?: SourceDestinationMarkingType;
}

/** Guide content keyed by editor mode. */
const MODE_GUIDES: Record<EditorMode, ModeGuideData> = {
  graph: {
    title: "Graph Editor",
    description:
      "Build the road network by placing nodes and connecting them with edges.",
    controls: [
      { keys: ["Left Click"], action: "Add or select node" },
      { keys: ["Drag"], action: "Move selected node" },
      { keys: ["Right Click"], action: "Remove node / edge" },
      { keys: ["Ctrl", "Z"], action: "Undo" },
      { keys: ["Ctrl", "Y"], action: "Redo" },
    ],
    tip: "Right-click the Graph tool icon to switch between one-way and two-way roads.",
  },
  "traffic-lights": {
    title: "Traffic Lights",
    description:
      "Place traffic lights along road edges to manage intersection flow.",
    controls: [
      { keys: ["Left Click"], action: "Place traffic light on edge" },
      { keys: ["Right Click"], action: "Remove traffic light" },
      { keys: ["Hover"], action: "Preview placement position" },
    ],
  },
  "stop-sign": {
    title: "Stop Signs",
    description: "Place stop signs along road edges to create stop points.",
    controls: [
      { keys: ["Left Click"], action: "Place stop sign on edge" },
      { keys: ["Right Click"], action: "Remove stop sign" },
      { keys: ["Hover"], action: "Preview placement position" },
    ],
  },
  "source-destination": {
    title: "Source & Destination",
    description:
      "Mark start and end points for vehicle pathfinding and simulation.",
    controls: [
      { keys: ["Left Click"], action: "Place marker on road edge" },
      { keys: ["Right Click"], action: "Remove marker" },
    ],
    tip: "Right-click the tool icon to switch between Source and Destination.",
  },
  path: {
    title: "Path Editor",
    description: "Define custom waypoint routes for vehicle navigation.",
    controls: [
      { keys: ["Left Click"], action: "Add waypoint to selected path" },
      { keys: ["Right Click"], action: "Remove last waypoint" },
    ],
    tip: "Use the Path Panel on the right to manage and create paths.",
  },
};

/**
 * Renders a styled keyboard/mouse key badge.
 */
function KbdBadge({ children }: { children: string }) {
  return (
    <kbd className="inline-flex items-center rounded border border-zinc-600/80 bg-zinc-700/60 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-300 shadow-sm">
      {children}
    </kbd>
  );
}

/**
 * Contextual guide overlay for the editor page.
 *
 * Displays the active mode's name, description, available controls, and
 * optional tips. Animates content when the mode changes. Includes a toggle
 * to collapse/expand the panel for a cleaner viewport.
 */
export function EditorGuide({
  activeMode,
  graphRoadType,
  sourceDestMarkingType,
}: EditorGuideProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  const guide = MODE_GUIDES[activeMode];

  // Extra context for modes with sub-types
  let subTypeLabel: string | undefined;
  if (activeMode === "graph") {
    subTypeLabel =
      graphRoadType === "directed"
        ? "One-way roads"
        : graphRoadType === "undirected"
          ? "Two-way roads"
          : undefined;
  } else if (activeMode === "source-destination") {
    subTypeLabel =
      sourceDestMarkingType === "source"
        ? "Placing: Source"
        : sourceDestMarkingType === "destination"
          ? "Placing: Destination"
          : undefined;
  }

  return (
    <div className="fixed bottom-4 left-4 z-40 max-w-xs">
      {/* Collapsed state toggle */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="mb-1.5 flex cursor-pointer items-center gap-1.5 rounded-lg border border-zinc-700/50 bg-zinc-800/90 px-2.5 py-1.5 text-[11px] font-medium text-zinc-400 backdrop-blur-sm transition-colors hover:bg-zinc-700/90 hover:text-zinc-200"
        aria-label={isExpanded ? "Hide guide" : "Show guide"}
        aria-expanded={isExpanded}
        aria-controls="editor-guide-panel"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-indigo-400"
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
          <path d="M12 17h.01" />
        </svg>
        {isExpanded ? "Hide Controls" : "Show Controls"}
      </button>

      {isExpanded && (
        <div
          id="editor-guide-panel"
          key={activeMode}
          className="overflow-hidden rounded-xl border border-zinc-700/50 bg-zinc-900/95 shadow-xl backdrop-blur-xl"
          style={{ animation: "guide-enter 0.25s ease-out" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-zinc-700/40 px-4 py-2.5">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-indigo-400" />
              <h4 className="text-sm font-semibold text-zinc-100">
                {guide.title}
              </h4>
            </div>
            {subTypeLabel && (
              <span className="rounded-full bg-indigo-500/15 px-2 py-0.5 text-[10px] font-medium text-indigo-300">
                {subTypeLabel}
              </span>
            )}
          </div>

          {/* Description */}
          <div className="border-b border-zinc-700/30 px-4 py-2">
            <p className="text-[11px] leading-relaxed text-zinc-400">
              {guide.description}
            </p>
          </div>

          {/* Controls */}
          <div className="space-y-1.5 px-4 py-3">
            <p className="mb-1.5 text-[10px] font-semibold tracking-wider text-zinc-500 uppercase">
              Controls
            </p>
            {guide.controls.map((control, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="flex shrink-0 items-center gap-0.5">
                  {control.keys.map((key, ki) => (
                    <span key={ki} className="flex items-center gap-0.5">
                      {ki > 0 && (
                        <span className="text-[9px] text-zinc-600">+</span>
                      )}
                      <KbdBadge>{key}</KbdBadge>
                    </span>
                  ))}
                </div>
                <span className="text-[11px] text-zinc-400">
                  {control.action}
                </span>
              </div>
            ))}
          </div>

          {/* Tip */}
          {guide.tip && (
            <div className="border-t border-zinc-700/30 px-4 py-2.5">
              <div className="flex gap-1.5">
                <span className="shrink-0 text-[11px] text-amber-400">💡</span>
                <p className="text-[10px] leading-relaxed text-zinc-500">
                  {guide.tip}
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
