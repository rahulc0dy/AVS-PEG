import Button from "@/components/ui/button";

interface FileToolbarProps {
  onImportOsm: () => void;
  onLoadJson: () => void;
  onSaveJson: () => void;
}

/**
 * Toolbar with file-related actions for the world editor.
 *
 * Renders three small buttons to import from OSM, import a saved JSON
 * world, and save the current world to JSON.
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
    <div className="fixed top-4 right-4 z-10 flex flex-col space-y-2">
      <Button onClick={onImportOsm} color="teal" className="text-xs">
        Import from OSM
      </Button>
      <Button onClick={onLoadJson} color="teal" className="text-xs">
        Import from JSON
      </Button>
      <Button onClick={onSaveJson} color="teal" className="text-xs">
        Save to JSON
      </Button>
    </div>
  );
}
