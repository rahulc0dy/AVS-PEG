import { Path } from "@/lib/markings/path";
import { SlideablePanel } from "@/components/ui/slideable-panel";
import { PathEditor } from "@/lib/editors/path-editor";
import { useEffect, useState, RefObject } from "react";
import Checkbox from "@/components/ui/checkbox";
import { CAR_MODELS } from "@/lib/car/car-models";

/**
 * Props for the PathPanel component.
 */
interface PathPanelProps {
  /**
   * Whether the panel is currently open and visible.
   */
  isVisible: boolean;
  /**
   * Reference to the PathEditor instance controlling the paths.
   * PathPanel actively mutates the editor's path data and triggers updates manually.
   */
  editorRef: RefObject<PathEditor | null>;
}

/**
 * PathPanel provides an interface to manage paths in the PathEditor.
 * It allows tracking created paths, adding new ones, toggling loop status, and deleting them.
 * State updates are forwarded to the editor to reflect in the visual simulation.
 */
export function PathPanel({ isVisible, editorRef }: PathPanelProps) {
  // We use local state to mirror the path editor's state so we can re-render
  const [paths, setPaths] = useState<Path[]>([]);
  const [selectedIdx, setSelectedIdx] = useState<number>(-1);

  // Sync state periodically or on mount/visibility change (placeholder logic)
  useEffect(() => {
    const editor = editorRef.current;
    if (isVisible && editor) {
      queueMicrotask(() => setPaths(editor.paths || []));
      queueMicrotask(() => setSelectedIdx(editor.selectedPathIdx ?? -1));
    }
  }, [isVisible, editorRef]);

  if (!isVisible) return null;

  return (
    <SlideablePanel
      title="Path Editor"
      position="right"
      expandedSize="20rem"
      defaultExpanded={true}
      panelClassName="bg-zinc-900 border-l border-white/10"
    >
      <div className="flex h-full flex-col overflow-hidden">
        <div className="flex items-center justify-between border-b border-white/10 p-4">
          <h3 className="text-sm font-medium text-white">Paths</h3>
          <button
            onClick={() => {
              const editor = editorRef.current;
              if (editor) {
                const newPath = new Path([], false);
                editor.paths.push(newPath);
                editor.selectedPathIdx = editor.paths.length - 1;
                editor.onUpdate?.();
                setPaths([...editor.paths]);
                setSelectedIdx(editor.selectedPathIdx);
              }
            }}
            className="flex h-6 w-6 items-center justify-center rounded bg-blue-500 pb-0.5 text-lg leading-none text-white hover:bg-blue-600"
            title="Create new path"
          >
            +
          </button>
        </div>

        <div className="flex-1 space-y-1 overflow-y-auto p-2">
          {paths.length === 0 ? (
            <div className="mt-4 text-center text-xs text-zinc-500">
              No paths created yet.
            </div>
          ) : (
            paths.map((path, idx) => (
              <div
                key={idx}
                className={`cursor-pointer rounded p-2 transition-colors ${
                  idx === selectedIdx
                    ? "border border-blue-500/50 bg-blue-500/20"
                    : "border border-transparent bg-white/5 hover:bg-white/10"
                } `}
                onClick={() => {
                  const editor = editorRef.current;
                  if (editor) {
                    editor.selectedPathIdx = idx;
                    setSelectedIdx(idx);
                  }
                }}
              >
                {/* Top row: path identity + actions */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 overflow-hidden">
                    <div
                      className="h-3.5 w-3.5 shrink-0 rounded-full border border-white/20"
                      style={{ backgroundColor: path.color }}
                    />
                    <span className="truncate text-sm text-zinc-300">
                      Path {idx + 1}
                    </span>
                    <span className="shrink-0 text-xs text-zinc-500">
                      · {path.waypoints?.length || 0} nodes
                    </span>
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    <div onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={path.isLoop}
                        onChange={(e) => {
                          path.isLoop = e.target.checked;
                          const editor = editorRef.current;
                          if (editor) {
                            editor.onUpdate?.();
                            setPaths([...editor.paths]);
                          }
                        }}
                        label="Loop"
                      />
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const editor = editorRef.current;
                        if (editor) {
                          editor.paths.splice(idx, 1);
                          if (idx < editor.selectedPathIdx) {
                            editor.selectedPathIdx--;
                          }
                          if (editor.selectedPathIdx >= editor.paths.length) {
                            editor.selectedPathIdx = Math.max(
                              -1,
                              editor.paths.length - 1,
                            );
                          }
                          editor.onUpdate?.();
                          setPaths([...editor.paths]);
                          setSelectedIdx(editor.selectedPathIdx);
                        }
                      }}
                      className="flex h-5 w-5 items-center justify-center rounded text-zinc-400 hover:bg-red-500/20 hover:text-red-400"
                      title="Delete path"
                    >
                      ×
                    </button>
                  </div>
                </div>

                {/* Bottom row: car model selector */}
                <div
                  className="mt-1.5 flex items-center gap-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  <span className="shrink-0 text-xs text-zinc-500">
                    Vehicle
                  </span>
                  <select
                    value={path.carModelId}
                    onChange={(e) => {
                      path.carModelId = e.target.value;
                      const editor = editorRef.current;
                      if (editor) {
                        editor.onUpdate?.();
                        setPaths([...editor.paths]);
                      }
                    }}
                    className="w-full min-w-0 rounded border border-white/10 bg-zinc-800 px-1.5 py-0.5 text-xs text-zinc-300 outline-none transition-colors hover:border-white/20 focus:border-blue-500/50"
                    title="Car model for this path"
                  >
                    {CAR_MODELS.map((model) => (
                      <option key={model.id} value={model.id}>
                        {model.displayName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </SlideablePanel>
  );
}
