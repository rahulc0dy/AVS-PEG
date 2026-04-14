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
  rotateIcon?: boolean;
  badge?: string;
}

/**
 * Button component for selecting editor tools.
 */
function ToolButton({
  mode,
  activeMode,
  onClick,
  onContextMenu,
  icon,
  alt,
  rotateIcon,
  badge,
}: ToolButtonProps) {
  const isActive = activeMode === mode;

  return (
    <button
      onClick={onClick}
      onContextMenu={onContextMenu}
      className={`
        relative flex items-center justify-center w-10 h-10 rounded-lg transition-colors
        ${
          isActive
            ? "bg-white/20 text-white"
            : "text-zinc-400 hover:bg-zinc-700/50 hover:text-zinc-200"
        }
      `}
      title={alt}
    >
      <Image
        src={icon}
        alt={alt}
        width={24}
        height={24}
        className={`size-5 ${rotateIcon ? "rotate-90" : ""} ${isActive ? "brightness-150 saturate-150" : "opacity-70 saturate-50"}`}
      />
      {badge && isActive && (
        <span className="absolute -top-1 -right-1 text-[10px] font-medium bg-zinc-600 text-zinc-100 px-1 rounded">
          {badge}
        </span>
      )}
    </button>
  );
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
      className="fixed z-100 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl py-1 min-w-36"
      style={{ left: x, top: y, transform: "translateY(-100%)" }}
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
      <button
        onClick={() => onSelect("source")}
        className={`w-full px-3 py-2 text-left text-sm transition-colors flex items-center gap-2 ${
          currentType === "source"
            ? "bg-white/10 text-white"
            : "text-zinc-300 hover:bg-zinc-700"
        }`}
      >
        <span className="w-2 h-2 rounded-full bg-emerald-500" />
        Source
      </button>
      <button
        onClick={() => onSelect("destination")}
        className={`w-full px-3 py-2 text-left text-sm transition-colors flex items-center gap-2 ${
          currentType === "destination"
            ? "bg-white/10 text-white"
            : "text-zinc-300 hover:bg-zinc-700"
        }`}
      >
        <span className="w-2 h-2 rounded-full bg-rose-500" />
        Destination
      </button>
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
      <button
        onClick={() => onSelect("undirected")}
        className={`w-full px-3 py-2 text-left text-sm transition-colors flex items-center gap-2 ${
          currentType === "undirected"
            ? "bg-white/10 text-white"
            : "text-zinc-300 hover:bg-zinc-700"
        }`}
      >
        <span className="w-4 text-center">⇄</span>
        Two-way Road
      </button>
      <button
        onClick={() => onSelect("directed")}
        className={`w-full px-3 py-2 text-left text-sm transition-colors flex items-center gap-2 ${
          currentType === "directed"
            ? "bg-white/10 text-white"
            : "text-zinc-300 hover:bg-zinc-700"
        }`}
      >
        <span className="w-4 text-center">→</span>
        One-way Road
      </button>
    </BaseContextMenu>
  );
}

/**
 * Toolbar component displaying editor mode buttons with context menus.
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
      <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2">
        <div className="flex items-center gap-1 rounded-xl border border-zinc-700 bg-zinc-800 px-2 py-2 shadow-lg">
          <ToolButton
            mode="graph"
            activeMode={activeMode}
            onClick={() => setMode("graph")}
            onContextMenu={handleGraphContextMenu}
            icon="/icons/graph.png"
            alt="Graph Editor (Right-click for options)"
            badge={
              activeMode === "graph"
                ? graphRoadType === "directed"
                  ? "→"
                  : "⇄"
                : undefined
            }
          />

          <ToolButton
            mode="traffic-lights"
            activeMode={activeMode}
            onClick={() => setMode("traffic-lights")}
            icon="/icons/traffic-lights.png"
            alt="Traffic Lights"
            rotateIcon
          />

          <ToolButton
            mode="stop-sign"
            activeMode={activeMode}
            onClick={() => setMode("stop-sign")}
            icon="/icons/stop-sign.png"
            alt="Stop Signs"
          />

          <ToolButton
            mode="source-destination"
            activeMode={activeMode}
            onClick={() => setMode("source-destination")}
            onContextMenu={handleSourceDestContextMenu}
            icon="/icons/source-destination.png"
            alt="Source & Destination (Right-click for options)"
            badge={
              activeMode === "source-destination"
                ? sourceDestinationMarkingType === "source"
                  ? "S"
                  : "D"
                : undefined
            }
          />

          <ToolButton
            mode="path"
            activeMode={activeMode}
            onClick={() => setMode("path")}
            icon="/icons/path.png"
            alt="Path Editor"
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
