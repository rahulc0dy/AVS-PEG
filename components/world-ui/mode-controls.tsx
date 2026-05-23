import { EditorMode } from "@/types/editor";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { GraphEdgeType, SourceDestinationMarkingType } from "@/types/marking";

/**
 * Props for the ModeControls component.
 */
interface ModeControlsProps {
  activeMode: EditorMode;
  setMode: (mode: EditorMode) => void;
  graphRoadType?: GraphEdgeType;
  onGraphRoadTypeChange?: (type: GraphEdgeType) => void;
  sourceDestinationMarkingType?: SourceDestinationMarkingType;
  onSourceDestinationTypeChange?: (type: SourceDestinationMarkingType) => void;
}

/**
 * Props for the ToolButton component.
 */
interface ToolButtonProps {
  mode: EditorMode;
  activeMode: EditorMode;
  onClick: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  icon: string;
  alt: string;
  label: string;
  rotateIcon?: boolean;
  badge?: string;
}

/**
 * Button component for selecting editor tools.
 * Renders an icon with a label beneath it and optional active/badge indicators.
 */
function ToolButton({
  mode,
  activeMode,
  onClick,
  onContextMenu,
  icon,
  alt,
  label,
  rotateIcon,
  badge,
}: ToolButtonProps) {
  const isActive = activeMode === mode;

  return (
    <button
      onClick={onClick}
      onContextMenu={onContextMenu}
      className={`
        group relative flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl px-3.5 py-2 transition-all duration-200
        ${
          isActive
            ? "bg-white/10 text-white"
            : "text-zinc-500 hover:bg-white/5 hover:text-zinc-300"
        }
      `}
      style={
        isActive
          ? { animation: "active-glow 3s ease-in-out infinite" }
          : undefined
      }
      title={alt}
    >
      {/* Icon with badge */}
      <div className="relative">
        <Image
          src={icon}
          alt={alt}
          width={22}
          height={22}
          className={`size-[22px] transition-all duration-200 ${rotateIcon ? "rotate-90" : ""} ${
            isActive
              ? "brightness-125 saturate-150"
              : "opacity-50 saturate-0 group-hover:opacity-75 group-hover:saturate-50"
          }`}
        />
        {badge && isActive && (
          <span className="absolute -top-1.5 -right-2.5 rounded-full bg-indigo-500 px-1 text-[9px] font-bold text-white shadow-sm">
            {badge}
          </span>
        )}
      </div>

      {/* Label */}
      <span
        className={`text-[10px] font-medium leading-none transition-colors ${
          isActive ? "text-zinc-200" : "text-zinc-600 group-hover:text-zinc-400"
        }`}
      >
        {label}
      </span>

      {/* Active indicator bar */}
      {isActive && (
        <div className="absolute bottom-0.5 left-1/2 h-[2px] w-5 -translate-x-1/2 rounded-full bg-indigo-400" />
      )}
    </button>
  );
}

/**
 * Thin vertical divider for grouping toolbar sections.
 */
function ToolbarDivider() {
  return <div className="mx-0.5 h-8 w-px self-center bg-zinc-700/60" />;
}

/**
 * Hook that handles closing a menu when clicking outside of it.
 * @param ref - Ref to the menu element.
 * @param handler - Callback to invoke when clicking outside.
 */
function useClickOutside(
  ref: React.RefObject<HTMLElement | null>,
  handler: () => void,
) {
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        handler();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [ref, handler]);
}

/**
 * Props for the BaseContextMenu component.
 */
interface BaseContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  children: React.ReactNode;
}

/**
 * Base context menu component with positioning and click-outside handling.
 */
function BaseContextMenu({ x, y, onClose, children }: BaseContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  useClickOutside(menuRef, onClose);

  return (
    <div
      ref={menuRef}
      className="fixed z-100 min-w-40 overflow-hidden rounded-xl border border-zinc-700/60 bg-zinc-800/95 py-1 shadow-2xl backdrop-blur-xl"
      style={{
        left: x,
        top: y,
        transform: "translateY(-100%)",
        animation: "guide-enter 0.15s ease-out",
      }}
    >
      {children}
    </div>
  );
}

/**
 * Props for the SourceDestContextMenu component.
 */
interface SourceDestContextMenuProps {
  x: number;
  y: number;
  onSelect: (type: SourceDestinationMarkingType) => void;
  onClose: () => void;
  currentType: SourceDestinationMarkingType;
}

/**
 * Context menu for selecting source or destination marking type.
 */
function SourceDestContextMenu({
  x,
  y,
  onSelect,
  onClose,
  currentType,
}: SourceDestContextMenuProps) {
  return (
    <BaseContextMenu x={x} y={y} onClose={onClose}>
      <div className="px-2 py-1.5">
        <p className="px-2 pb-1.5 text-[10px] font-semibold tracking-wider text-zinc-500 uppercase">
          Marker Type
        </p>
        <button
          onClick={() => onSelect("source")}
          className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors ${
            currentType === "source"
              ? "bg-emerald-500/15 text-emerald-300"
              : "text-zinc-300 hover:bg-zinc-700/60"
          }`}
        >
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-sm" />
          Source
          {currentType === "source" && (
            <span className="ml-auto text-[10px] text-emerald-400">✓</span>
          )}
        </button>
        <button
          onClick={() => onSelect("destination")}
          className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors ${
            currentType === "destination"
              ? "bg-rose-500/15 text-rose-300"
              : "text-zinc-300 hover:bg-zinc-700/60"
          }`}
        >
          <span className="h-2.5 w-2.5 rounded-full bg-rose-500 shadow-sm" />
          Destination
          {currentType === "destination" && (
            <span className="ml-auto text-[10px] text-rose-400">✓</span>
          )}
        </button>
      </div>
    </BaseContextMenu>
  );
}

/**
 * Props for the GraphContextMenu component.
 */
interface GraphContextMenuProps {
  x: number;
  y: number;
  onSelect: (type: GraphEdgeType) => void;
  onClose: () => void;
  currentType: GraphEdgeType;
}

/**
 * Context menu for selecting graph edge type (one-way or two-way roads).
 */
function GraphContextMenu({
  x,
  y,
  onSelect,
  onClose,
  currentType,
}: GraphContextMenuProps) {
  return (
    <BaseContextMenu x={x} y={y} onClose={onClose}>
      <div className="px-2 py-1.5">
        <p className="px-2 pb-1.5 text-[10px] font-semibold tracking-wider text-zinc-500 uppercase">
          Road Type
        </p>
        <button
          onClick={() => onSelect("undirected")}
          className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors ${
            currentType === "undirected"
              ? "bg-indigo-500/15 text-indigo-300"
              : "text-zinc-300 hover:bg-zinc-700/60"
          }`}
        >
          <span className="w-4 text-center text-base">⇄</span>
          Two-way Road
          {currentType === "undirected" && (
            <span className="ml-auto text-[10px] text-indigo-400">✓</span>
          )}
        </button>
        <button
          onClick={() => onSelect("directed")}
          className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors ${
            currentType === "directed"
              ? "bg-indigo-500/15 text-indigo-300"
              : "text-zinc-300 hover:bg-zinc-700/60"
          }`}
        >
          <span className="w-4 text-center text-base">→</span>
          One-way Road
          {currentType === "directed" && (
            <span className="ml-auto text-[10px] text-indigo-400">✓</span>
          )}
        </button>
      </div>
    </BaseContextMenu>
  );
}

/**
 * Toolbar component displaying editor mode buttons with labels,
 * visual grouping, and context menus for sub-type selection.
 */
export function ModeControls({
  activeMode,
  setMode,
  graphRoadType = "undirected",
  onGraphRoadTypeChange,
  sourceDestinationMarkingType = "source",
  onSourceDestinationTypeChange,
}: ModeControlsProps) {
  const [sourceDestMenu, setSourceDestMenu] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [graphMenu, setGraphMenu] = useState<{ x: number; y: number } | null>(
    null,
  );

  const handleGraphContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setGraphMenu({ x: e.clientX, y: e.clientY });
    setSourceDestMenu(null);
  };

  const handleGraphTypeSelect = (type: GraphEdgeType) => {
    onGraphRoadTypeChange?.(type);
    setMode("graph");
    setGraphMenu(null);
  };

  const handleSourceDestContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setSourceDestMenu({ x: e.clientX, y: e.clientY });
    setGraphMenu(null);
  };

  const handleSourceDestTypeSelect = (type: SourceDestinationMarkingType) => {
    onSourceDestinationTypeChange?.(type);
    setMode("source-destination");
    setSourceDestMenu(null);
  };

  return (
    <>
      <div className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2">
        <div className="flex items-center gap-0.5 rounded-2xl border border-zinc-700/50 bg-zinc-900/95 px-2 py-1.5 shadow-2xl backdrop-blur-xl">
          {/* Graph tools group */}
          <ToolButton
            mode="graph"
            activeMode={activeMode}
            onClick={() => setMode("graph")}
            onContextMenu={handleGraphContextMenu}
            icon="/icons/graph.png"
            alt="Graph Editor (Right-click for road type)"
            label="Graph"
            badge={
              activeMode === "graph"
                ? graphRoadType === "directed"
                  ? "→"
                  : "⇄"
                : undefined
            }
          />

          <ToolbarDivider />

          {/* Markings group */}
          <ToolButton
            mode="traffic-lights"
            activeMode={activeMode}
            onClick={() => setMode("traffic-lights")}
            icon="/icons/traffic-lights.png"
            alt="Traffic Lights"
            label="Lights"
            rotateIcon
          />

          <ToolButton
            mode="stop-sign"
            activeMode={activeMode}
            onClick={() => setMode("stop-sign")}
            icon="/icons/stop-sign.png"
            alt="Stop Signs"
            label="Stop"
          />

          <ToolButton
            mode="source-destination"
            activeMode={activeMode}
            onClick={() => setMode("source-destination")}
            onContextMenu={handleSourceDestContextMenu}
            icon="/icons/source-destination.png"
            alt="Source & Destination (Right-click for type)"
            label="S / D"
            badge={
              activeMode === "source-destination"
                ? sourceDestinationMarkingType === "source"
                  ? "S"
                  : "D"
                : undefined
            }
          />

          <ToolbarDivider />

          {/* Path group */}
          <ToolButton
            mode="path"
            activeMode={activeMode}
            onClick={() => setMode("path")}
            icon="/icons/route.png"
            alt="Path Editor"
            label="Path"
          />
        </div>
      </div>

      {sourceDestMenu && (
        <SourceDestContextMenu
          x={sourceDestMenu.x}
          y={sourceDestMenu.y}
          onSelect={handleSourceDestTypeSelect}
          onClose={() => setSourceDestMenu(null)}
          currentType={sourceDestinationMarkingType}
        />
      )}

      {graphMenu && (
        <GraphContextMenu
          x={graphMenu.x}
          y={graphMenu.y}
          onSelect={handleGraphTypeSelect}
          onClose={() => setGraphMenu(null)}
          currentType={graphRoadType}
        />
      )}
    </>
  );
}
