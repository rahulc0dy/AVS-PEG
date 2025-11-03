"use client";

import Car from "@/components/car";
import { useScene } from "@/components/car-scene-provider";

function CarPage() {
  const scene = useScene();
  const carModelPath = "/assets/car.gltf";

  return <Car modelPath={carModelPath} scene={scene} />;
}

export default CarPage;
