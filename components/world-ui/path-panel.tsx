import { Path } from "@/lib/markings/path";
import { SlideablePanel } from "@/components/ui/slideable-panel";
import { PathEditor } from "@/lib/editors/path-editor";
import { useEffect, useState } from "react";
import Checkbox from "@/components/ui/checkbox";

interface PathPanelProps {
  isVisible: boolean;
  editorRef: React.MutableRefObject<PathEditor | null>;
}

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
      <div className="flex flex-col h-full overflow-hidden">
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <h3 className="font-medium text-white text-sm">Paths</h3>
          <button
            onClick={() => {
              const editor = editorRef.current;
              if (editor) {
                // Placeholder core logic call: e.g. editor.addNewPath()
                const newPath = new Path([], false); // Empty path
                editor.paths.push(newPath);
                editor.selectedPathIdx = editor.paths.length - 1;
                setPaths([...editor.paths]);
                setSelectedIdx(editor.selectedPathIdx);
              }
            }}
            className="w-6 h-6 rounded bg-blue-500 hover:bg-blue-600 flex items-center justify-center text-white text-lg leading-none pb-0.5"
            title="Create new path"
          >
            +
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {paths.length === 0 ? (
            <div className="text-center text-xs text-zinc-500 mt-4">
              No paths created yet.
            </div>
          ) : (
            paths.map((path, idx) => (
              <div
                key={idx}
                className={`
                  flex items-center justify-between p-2 rounded cursor-pointer transition-colors
                  ${
                    idx === selectedIdx
                      ? "bg-blue-500/20 border border-blue-500/50"
                      : "bg-white/5 border border-transparent hover:bg-white/10"
                  }
                `}
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
                    className="w-4 h-4 rounded-full border border-white/20"
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
                        if (editor.selectedPathIdx >= editor.paths.length) {
                          editor.selectedPathIdx = Math.max(
                            -1,
                            editor.paths.length - 1,
                          );
                        }
                        setPaths([...editor.paths]);
                        setSelectedIdx(editor.selectedPathIdx);
                      }
                    }}
                    className="w-6 h-6 rounded hover:bg-red-500/20 flex items-center justify-center text-zinc-400 hover:text-red-400"
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
