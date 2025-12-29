import Button from "@/components/ui/button";
import { EditorMode } from "@/types/editor";
import Image from "next/image";

interface ModeControlsProps {
  activeMode: EditorMode;
  setMode: (mode: EditorMode) => void;
}

/**
 * Controls to switch between editor modes and show the active mode.
 *
 * Displays the current `activeMode` and renders two buttons to toggle
 * between the available editors ("graph", "traffic-lights", and
 * "source-destination"). The active button is shown in full color while
 * inactive ones are grayscaled.
 *
 * @param {object} props - Component props.
 * @param {EditorMode} props.activeMode - Currently selected editor mode.
 * @param {(mode: EditorMode) => void} props.setMode - Setter to change the active mode.
 * @returns {JSX.Element} Mode controls UI.
 */
export function ModeControls({ activeMode, setMode }: ModeControlsProps) {
  return (
    <>
      <div className="fixed right-4 bottom-4 z-100 text-gray-200">
        <p className="font-bold text-gray-100">
          Mode: <span className="text-green-300 uppercase">{activeMode}</span>
        </p>
      </div>
      <div className="fixed right-0 bottom-4 left-0 flex items-center justify-center gap-5">
        <Button
          onClick={() => setMode("graph")}
          color="white"
          style={{ filter: activeMode === "graph" ? "" : "grayscale(100%)" }}
        >
          <Image
            src={"/icons/graph.png"}
            alt="graph"
            width={30}
            height={50}
            className="size-6"
          />
        </Button>
        <Button
          onClick={() => setMode("traffic-lights")}
          color="white"
          style={{
            filter: activeMode === "traffic-lights" ? "" : "grayscale(100%)",
          }}
        >
          <Image
            src={"/icons/traffic-lights.png"}
            alt="traffic-lights"
            width={30}
            height={50}
            className="size-6 rotate-90"
          />
        </Button>
        <Button
          onClick={() => setMode("source-destination")}
          color="white"
          style={{
            filter:
              activeMode === "source-destination" ? "" : "grayscale(100%)",
          }}
        >
          <Image
            src={"/icons/source-destination.png"}
            alt="source-destination"
            width={30}
            height={50}
            className="size-6 rotate-90"
          />
        </Button>
      </div>
    </>
  );
}
