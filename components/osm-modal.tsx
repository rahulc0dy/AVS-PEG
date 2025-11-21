"use client";

import { useState } from "react";
import Modal from "@/components/modal";
import { getRoadData } from "@/services/osm-service";

interface OsmModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const OsmModal: React.FC<OsmModalProps> = ({ isOpen, onClose }) => {
  const [minLat, setMinLat] = useState(22.576851981848424);
  const [minLon, setMinLon] = useState(88.4058666229248);
  const [maxLat, setMaxLat] = useState(22.593168369979654);
  const [maxLon, setMaxLon] = useState(88.42663764953615);

  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleGetRoadData = async () => {
    setError(null);
    setIsLoading(true);
    try {
      const res = await getRoadData(minLat, minLon, maxLat, maxLon);
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
