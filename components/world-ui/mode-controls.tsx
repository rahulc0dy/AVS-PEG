import { EditorMode } from "@/types/editor";
import { SourceDestinationMarkingType } from "@/lib/editors/source-destination-editor";
import Image from "next/image";
import { useState, useRef, useEffect } from "react";

interface ModeControlsProps {
  activeMode: EditorMode;
  setMode: (mode: EditorMode) => void;
  sourceDestinationMarkingType?: SourceDestinationMarkingType;
  onSourceDestinationTypeChange?: (type: SourceDestinationMarkingType) => void;
}

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
        className={`size-5 ${rotateIcon ? "rotate-90" : ""} ${isActive ? "brightness-0 invert" : "opacity-70"}`}
      />
      {badge && isActive && (
        <span className="absolute -top-1 -right-1 text-[10px] font-medium bg-zinc-600 text-zinc-100 px-1 rounded">
          {badge}
        </span>
      )}
    </button>
  );
}

interface ContextMenuProps {
  x: number;
  y: number;
  onSelect: (type: SourceDestinationMarkingType) => void;
  onClose: () => void;
  currentType: SourceDestinationMarkingType;
}

function ContextMenu({
  x,
  y,
  onSelect,
  onClose,
  currentType,
}: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      className="fixed z-100 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl py-1 min-w-36"
      style={{ left: x, top: y, transform: "translateY(-100%)" }}
    >
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
    </div>
  );
}

/**
 * Controls to switch between editor modes - tldraw/figma style toolbar.
 *
 * A horizontal bar with icon buttons where the active mode is highlighted.
 * Right-click on source-destination button shows a context menu to choose mode.
 *
 * @param {object} props - Component props.
 * @param {EditorMode} props.activeMode - Currently selected editor mode.
 * @param {(mode: EditorMode) => void} props.setMode - Setter to change the active mode.
 * @returns {JSX.Element} Mode controls UI.
 */
export function ModeControls({
  activeMode,
  setMode,
  sourceDestinationMarkingType = "source",
  onSourceDestinationTypeChange,
}: ModeControlsProps) {
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
  } | null>(null);

  const handleSourceDestContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const handleContextMenuSelect = (type: SourceDestinationMarkingType) => {
    onSourceDestinationTypeChange?.(type);
    setMode("source-destination");
    setContextMenu(null);
  };

  return (
    <>
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50">
        <div className="flex items-center gap-1 px-2 py-2 bg-zinc-800 border border-zinc-700 rounded-xl shadow-lg">
          <ToolButton
            mode="graph"
            activeMode={activeMode}
            onClick={() => setMode("graph")}
            icon="/icons/graph.png"
            alt="Graph Editor"
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
        </div>
      </div>

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onSelect={handleContextMenuSelect}
          onClose={() => setContextMenu(null)}
          currentType={sourceDestinationMarkingType}
        />
      )}
    </>
  );
}
