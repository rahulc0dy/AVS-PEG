import Button from "@/components/ui/button";

interface FileToolbarProps {
  onImportOsm: () => void;
  onLoadJson: () => void;
  onSaveJson: () => void;
}

/**
 * Toolbar with file-related actions for the world editor.
 *
 * Renders three styled buttons to import from OSM, import a saved JSON
 * world, and save the current world to JSON, using glassmorphism and icons.
 *
 * @param {object} props - Component props.
 * @param {() => void} props.onImportOsm - Called when the "Import from OSM" button is clicked.
 * @param {() => void} props.onLoadJson - Called when the "Import from JSON" button is clicked.
 * @param {() => void} props.onSaveJson - Called when the "Save to JSON" button is clicked.
 * @returns {JSX.Element} The file toolbar element.
 */
export function FileToolbar({
  onImportOsm,
  onLoadJson,
  onSaveJson,
}: FileToolbarProps) {
  return (
    <div className="fixed top-4 right-4 z-10 flex flex-col space-y-1.5">
      <div className="overflow-hidden rounded-xl border border-zinc-700/50 bg-zinc-900/90 shadow-xl backdrop-blur-xl">
        <div className="flex flex-col divide-y divide-zinc-700/40">
          <button
            onClick={onImportOsm}
            className="flex cursor-pointer items-center gap-2.5 px-3.5 py-2.5 text-left text-xs font-medium text-zinc-300 transition-colors hover:bg-zinc-700/40 hover:text-white"
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
              className="shrink-0 text-emerald-400"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M2 12h20" />
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
            </svg>
            Import from OSM
          </button>
          <button
            onClick={onLoadJson}
            className="flex cursor-pointer items-center gap-2.5 px-3.5 py-2.5 text-left text-xs font-medium text-zinc-300 transition-colors hover:bg-zinc-700/40 hover:text-white"
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
              className="shrink-0 text-blue-400"
            >
              <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
              <polyline points="14 2 14 8 20 8" />
              <path d="M12 18v-6" />
              <path d="m9 15 3 3 3-3" />
            </svg>
            Import from JSON
          </button>
          <button
            onClick={onSaveJson}
            className="flex cursor-pointer items-center gap-2.5 px-3.5 py-2.5 text-left text-xs font-medium text-zinc-300 transition-colors hover:bg-zinc-700/40 hover:text-white"
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
              className="shrink-0 text-indigo-400"
            >
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
              <polyline points="17 21 17 13 7 13 7 21" />
              <polyline points="7 3 7 8 15 8" />
            </svg>
            Save to JSON
          </button>
        </div>
      </div>
    </div>
  );
}
