"use client";

import { useEffect, useState } from "react";
import Modal from "@/components/ui/modal";
import Button from "@/components/ui/button";
import { getRoadData } from "@/services/osm-service";
import { Graph } from "@/lib/primitives/graph";
import { parseRoadsFromOsmData } from "@/utils/osm";
import { Node } from "@/lib/primitives/node";
import Link from "next/link";

interface OsmModalProps {
  isOpen: boolean;
  onClose: () => void;
  graphRef: React.RefObject<Graph | null>;
}

interface BoundingBox {
  minLat: number;
  minLong: number;
  maxLat: number;
  maxLong: number;
}

const OsmModal: React.FC<OsmModalProps> = ({ isOpen, onClose, graphRef }) => {
  const [minLat, setMinLat] = useState(22.574181);
  const [minLong, setMinLong] = useState(88.410046);
  const [maxLat, setMaxLat] = useState(22.57859);
  const [maxLong, setMaxLong] = useState(88.418468);

  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const saveBbox = () => {
    localStorage.setItem(
      "b-box",
      JSON.stringify({
        minLat,
        minLong,
        maxLat,
        maxLong,
      })
    );
  };

  const loadBbox = () => {
    const bBoxStr = localStorage.getItem("b-box");
    if (bBoxStr) {
      try {
        const bBox = JSON.parse(bBoxStr) as BoundingBox;
        setMinLat(bBox.minLat);
        setMinLong(bBox.minLong);
        setMaxLat(bBox.maxLat);
        setMaxLong(bBox.maxLong);
      } catch (e) {
        console.error("Failed to parse bounding box from local storage", e);
      }
    }
  };

  const handleGetRoadData = async () => {
    setError(null);
    setIsLoading(true);

    saveBbox();

    try {
      const res = await getRoadData(minLat, minLong, maxLat, maxLong);
      const newGraph = parseRoadsFromOsmData(res);

      if (graphRef.current) {
        // Update the existing graph instance to maintain references held by World/Editor
        graphRef.current.load(newGraph.getNodes(), newGraph.getEdges());
        // Trigger an update in the WorldComponent loop
        graphRef.current.touch();
      }
      onClose();
    } catch (err) {
      setError("An error occurred: " + (err as Error).message);
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
        {error && (
          <div className="p-3 text-sm text-red-600 bg-red-50 rounded-md">
            {error}
          </div>
        )}
        <div className="grid grid-cols-3 gap-4 items-center p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="col-start-2 space-y-1">
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 text-center">
              Max Lat (North)
            </label>
            <input
              type="number"
              step="any"
              value={maxLat}
              onChange={(e) => setMaxLat(parseFloat(e.target.value))}
              className="w-full px-2 py-1 text-sm text-center border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
            />
          </div>

          <div className="col-start-1 space-y-1">
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 text-center">
              Min Lon (West)
            </label>
            <input
              type="number"
              step="any"
              value={minLong}
              onChange={(e) => setMinLong(parseFloat(e.target.value))}
              className="w-full px-2 py-1 text-sm text-center border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
            />
          </div>

          <div className="col-start-3 space-y-1">
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 text-center">
              Max Lon (East)
            </label>
            <input
              type="number"
              step="any"
              value={maxLong}
              onChange={(e) => setMaxLong(parseFloat(e.target.value))}
              className="w-full px-2 py-1 text-sm text-center border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
            />
          </div>

          <div className="col-start-2 space-y-1">
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 text-center">
              Min Lat (South)
            </label>
            <input
              type="number"
              step="any"
              value={minLat}
              onChange={(e) => setMinLat(parseFloat(e.target.value))}
              className="w-full px-2 py-1 text-sm text-center border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
            />
          </div>
        </div>
        <Link
          href={"https://www.openstreetmap.org/export"}
          className="text-xs text-gray-400 float-right align-bottom"
        >
          Export from OpenStreetMaps
        </Link>
      </div>
    </Modal>
  );
};

export default OsmModal;
