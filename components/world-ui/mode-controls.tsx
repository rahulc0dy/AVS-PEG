import { EditorMode } from "@/types/editor";
import Image from "next/image";

interface ModeControlsProps {
  activeMode: EditorMode;
  setMode: (mode: EditorMode) => void;
}

interface ToolButtonProps {
  mode: EditorMode;
  activeMode: EditorMode;
  onClick: () => void;
  icon: string;
  alt: string;
  rotateIcon?: boolean;
}

function ToolButton({
  mode,
  activeMode,
  onClick,
  icon,
  alt,
  rotateIcon,
}: ToolButtonProps) {
  const isActive = activeMode === mode;

  return (
    <button
      onClick={onClick}
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
    </button>
  );
}

/**
 * Controls to switch between editor modes - tldraw/figma style toolbar.
 *
 * A horizontal bar with icon buttons where the active mode is highlighted.
 *
 * @param {object} props - Component props.
 * @param {EditorMode} props.activeMode - Currently selected editor mode.
 * @param {(mode: EditorMode) => void} props.setMode - Setter to change the active mode.
 * @returns {JSX.Element} Mode controls UI.
 */
export function ModeControls({ activeMode, setMode }: ModeControlsProps) {
  return (
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
          icon="/icons/source-destination.png"
          alt="Source & Destination"
        />
      </div>
    </div>
  );
}
