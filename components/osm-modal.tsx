"use client";

import { useEffect, useState } from "react";
import Modal from "@/components/modal";
import { getRoadData } from "@/services/osm-service";
import { Graph } from "@/lib/primitives/graph";
import { parseRoadsFromOsmData } from "@/utils/osm";
import { Node } from "@/lib/primitives/node";

interface OsmModalProps {
  isOpen: boolean;
  onClose: () => void;
  graphRef: React.RefObject<Graph | null>;
}

const OsmModal: React.FC<OsmModalProps> = ({ isOpen, onClose, graphRef }) => {
  const [minLat, setMinLat] = useState(22.576851981848424);
  const [minLon, setMinLon] = useState(88.4058666229248);
  const [maxLat, setMaxLat] = useState(22.593168369979654);
  const [maxLon, setMaxLon] = useState(88.42663764953615);

  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    handleGetRoadData();
  }, []);

  const handleGetRoadData = async () => {
    setError(null);
    setIsLoading(true);
    try {
      const res = await getRoadData(minLat, minLon, maxLat, maxLon);
      // if (graphRef.current) {
      //   // Update the graph with the new data
      //   graphRef.current = parseRoadsFromOsmData(res);
      //   graphRef.current.touch();
      // }
      graphRef.current?.tryAddNode(new Node(10, 10));
      onClose();
    } catch (err) {
      setError("An error occurred: " + (err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="w-94 space-y-4 p-8"></div>
    </Modal>
  );
};

export default OsmModal;
