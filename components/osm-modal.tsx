"use client";

import { FC, RefObject, useEffect, useState } from "react";
import Modal from "@/components/ui/modal";
import Button from "@/components/ui/button";
import { getRoadData } from "@/services/osm-service";
import { parseRoadsFromOsmData } from "@/utils/osm";
import Link from "next/link";
import { World } from "@/lib/world";

/**
 * Props for `OsmModal`.
 *
 * - `isOpen`: whether the modal is visible.
 * - `onClose`: callback to close the modal.
 * - `worldRef`: a React ref pointing to the current `World` instance; used
 *   to load parsed OSM data without replacing the object reference.
 */
interface OsmModalProps {
  isOpen: boolean;
  onClose: () => void;
  worldRef: RefObject<World | null>;
}

/**
 * A simple bounding-box shape persisted to `localStorage`.
 */
interface BoundingBox {
  minLat: number;
  minLong: number;
  maxLat: number;
  maxLong: number;
}

/**
 * This modal allows the user to enter a geographic bounding box (min/max
 * latitude and longitude) and load OpenStreetMap (OSM) road data for that
 * region. The modal persists the last-used bounding box to `localStorage`
 * under the key `b-box` and will load it when the component mounts.
 *
 * The loaded OSM data is parsed into a `Graph` instance and applied to the
 * `graphRef` passed by the parent. The existing graph instance is updated in
 * place to ensure references held elsewhere in the app remain intact.
 */
const OsmModal: FC<OsmModalProps> = ({ isOpen, onClose, worldRef }) => {
  const [minLat, setMinLat] = useState(22.574181);
  const [minLong, setMinLong] = useState(88.410046);
  const [maxLat, setMaxLat] = useState(22.57859);
  const [maxLong, setMaxLong] = useState(88.418468);

  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const saveBbox = () => {
    // Persist the current bounding box so the user doesn't have to re-enter
    // values on the next visit.
    try {
      localStorage.setItem(
        "b-box",
        JSON.stringify({
          minLat,
          minLong,
          maxLat,
          maxLong,
        }),
      );
    } catch (e) {
      // localStorage may throw (private mode, quota exceeded); fail silently
      // but log for debugging.

      console.warn("Could not save bounding box to localStorage", e);
    }
  };

  const loadBbox = () => {
    // Attempt to restore the saved bounding box. If parsing fails, ignore and
    // keep defaults so the modal is still usable.
    try {
      const bBoxStr = localStorage.getItem("b-box");
      if (!bBoxStr) return;
      const bBox = JSON.parse(bBoxStr) as BoundingBox;
      // Basic validation: ensure numbers exist before applying
      setMinLat(bBox.minLat);
      setMinLong(bBox.minLong);
      setMaxLat(bBox.maxLat);
      setMaxLong(bBox.maxLong);
    } catch (e) {
      console.error("Failed to parse bounding box from local storage", e);
    }
  };

  const handleGetRoadData = async () => {
    setError(null);
    setIsLoading(true);

    saveBbox();

    try {
      // Fetch raw OSM data for the bounding box and parse it into the project's
      // Graph format. The service function `getRoadData` handles the network
      // request; `parseRoadsFromOsmData` converts the response into a Graph.
      const res = await getRoadData(minLat, minLong, maxLat, maxLong);
      const newGraph = parseRoadsFromOsmData(res);

      const graph = worldRef.current?.graph;
      if (graph) {
        // Update the existing graph instance in-place so other components
        // holding the same reference continue to work without re-mounts.
        graph.load(newGraph.getNodes(), newGraph.getEdges());
      }
      onClose();
    } catch (err) {
      // Surface a human-readable message to the user while logging details
      // to the console for debugging.
      const message = err instanceof Error ? err.message : String(err);
      setError("An error occurred: " + message);

      console.error("Error loading OSM data", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadBbox();
  }, []);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Load OSM Data"
      description="Enter the bounding box coordinates to load road data from OpenStreetMap."
      footer={
        <>
          <Button
            variant="ghost"
            color="gray"
            onClick={onClose}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleGetRoadData}
            color="white"
            disabled={isLoading}
          >
            {isLoading ? "Loading..." : "Load Data"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Error banner: shown when an error message exists */}
        {error && (
          <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">
            {error}
          </div>
        )}

        {/*
          Input grid for bounding box values. The layout is three columns:
          - left: Min Lon (West)
          - center: Max Lat (North) and Min Lat (South)
          - right: Max Lon (East)
        */}
        <div className="grid grid-cols-3 items-center gap-4 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/50">
          <div className="col-start-2 space-y-1">
            <label className="block text-center text-xs font-medium text-gray-500 dark:text-gray-400">
              Max Lat (North)
            </label>
            <input
              type="number"
              step="any"
              value={maxLat}
              onChange={(e) => {
                const val = e.target.valueAsNumber;
                if (!isNaN(val)) setMaxLat(val);
              }}
              className="w-full rounded-md border border-gray-300 bg-white px-2 py-1 text-center text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
            />
          </div>

          <div className="col-start-1 space-y-1">
            <label className="block text-center text-xs font-medium text-gray-500 dark:text-gray-400">
              Min Lon (West)
            </label>
            <input
              type="number"
              step="any"
              value={minLong}
              onChange={(e) => {
                const val = e.target.valueAsNumber;
                if (!isNaN(val)) setMinLong(val);
              }}
              className="w-full rounded-md border border-gray-300 bg-white px-2 py-1 text-center text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
            />
          </div>

          <div className="col-start-3 space-y-1">
            <label className="block text-center text-xs font-medium text-gray-500 dark:text-gray-400">
              Max Lon (East)
            </label>
            <input
              type="number"
              step="any"
              value={maxLong}
              onChange={(e) => {
                const val = e.target.valueAsNumber;
                if (!isNaN(val)) setMaxLong(val);
              }}
              className="w-full rounded-md border border-gray-300 bg-white px-2 py-1 text-center text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
            />
          </div>

          <div className="col-start-2 space-y-1">
            <label className="block text-center text-xs font-medium text-gray-500 dark:text-gray-400">
              Min Lat (South)
            </label>
            <input
              type="number"
              step="any"
              value={minLat}
              onChange={(e) => {
                const val = e.target.valueAsNumber;
                if (!isNaN(val)) setMinLat(val);
              }}
              className="w-full rounded-md border border-gray-300 bg-white px-2 py-1 text-center text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
            />
          </div>
        </div>

        {/* Helpful external link for exporting a bounding box from OSM */}
        <Link
          href={"https://www.openstreetmap.org/export"}
          target="_blank"
          rel="noopener noreferrer"
          className="float-right align-bottom text-xs text-gray-400"
        >
          Export from OpenStreetMaps
        </Link>
      </div>
    </Modal>
  );
};

export default OsmModal;
