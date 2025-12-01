import Button from "@/components/ui/button";

interface FileToolbarProps {
  onImportOsm: () => void;
  onLoadJson: () => void;
  onSaveJson: () => void;
}

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
