"use client";

import { useEffect, useRef, useState } from "react";
import { Scene, Object3D, Box3, Vector3, Clock } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { useKeyboardControls } from "@/hooks/useKeyboardControls";

const Car = ({
  modelPath,
  scene,
}: {
  modelPath: string;
  scene: Scene | null;
}) => {
  const keyboardControls = useKeyboardControls();
  const [model, setModel] = useState<Object3D | null>(null);
  const [speed, setSpeed] = useState(5);
  const [turnSpeed, setTurnSpeed] = useState(1.5);
  const clockRef = useRef(new Clock());

  useEffect(() => {
    if (!scene || !modelPath) return;

    const onError = (error: any) => {
      console.error(`Error loading model "${modelPath}":`, error);
    };

    const loader = new GLTFLoader();
    loader.load(
      modelPath,
      (gltf) => {
        scene.add(gltf.scene);
        setModel(gltf.scene);
      },
      undefined,
      onError
    );

    return () => {
      if (model) {
        scene.remove(model);
      }
      setModel(null);
    };
  }, [modelPath, scene]);

  useEffect(() => {
    if (!model) return;

    let animationFrameId: number;

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const delta = clockRef.current.getDelta();

      const { forward, backward, left, right } = keyboardControls.current;

      if (forward) model.translateZ(speed * delta);
      if (backward) model.translateZ(-speed * delta);
      if (left) model.rotateY(turnSpeed * delta);
      if (right) model.rotateY(-turnSpeed * delta);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [model, keyboardControls, speed, turnSpeed]); // Dependency array now correctly includes 'model'

  return (
    <div className="absolute top-4 right-4 bg-black/70 p-4 rounded-lg text-white space-y-4 w-64">
      <div>
        <label className="block text-xs font-semibold">
          Movement Speed: {speed.toFixed(1)}
        </label>
        <input
          type="range"
          min="0"
          max="20"
          step="0.5"
          value={speed}
          onChange={(e) => setSpeed(parseFloat(e.target.value))}
          className="w-full h-0.5"
        />
      </div>
      <div>
        <label className="block text-xs font-semibold">
          Turn Speed: {turnSpeed.toFixed(2)}
        </label>
        <input
          type="range"
          min="0"
          max="5"
          step="0.1"
          value={turnSpeed}
          onChange={(e) => setTurnSpeed(parseFloat(e.target.value))}
          className="w-full h-0.5"
        />
      </div>
    </div>
  );
};

export default Car;
