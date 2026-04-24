import { Path } from "@/lib/markings/path";
import { SlideablePanel } from "@/components/ui/slideable-panel";
import { PathEditor } from "@/lib/editors/path-editor";
import { useEffect, useState, RefObject } from "react";
import Checkbox from "@/components/ui/checkbox";

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
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPaths(editor.paths || []);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedIdx(editor.selectedPathIdx ?? -1);
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
                // Placeholder core logic call: e.g. editor.addNewPath()
                const newPath = new Path([], false); // Empty path
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
                className={`flex cursor-pointer items-center justify-between rounded p-2 transition-colors ${
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
                <div className="flex items-center space-x-3">
                  <div
                    className="h-4 w-4 rounded-full border border-white/20"
                    style={{ backgroundColor: path.color }}
                  />
                  <span className="text-sm text-zinc-300">Path {idx + 1}</span>
                </div>

                <div className="flex items-center space-x-3">
                  <span className="text-xs text-zinc-500">
                    {path.waypoints?.length || 0} nodes
                  </span>

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
                      className="ml-1"
                      label="Loop"
                    />
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const editor = editorRef.current;
                      if (editor) {
                        // Placeholder core logic call: e.g. editor.removePath(idx)
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
                    className="flex h-6 w-6 items-center justify-center rounded text-zinc-400 hover:bg-red-500/20 hover:text-red-400"
                    title="Delete path"
                  >
                    ×
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </SlideablePanel>
  );
}
