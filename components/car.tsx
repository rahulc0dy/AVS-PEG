"use client";

import { useEffect, useRef, useState } from "react";
import { Scene, Object3D, Box3, Vector3, Clock } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { useKeyboardControls } from "../hooks/useKeyboardControls";

const Car = ({
  modelPath,
  scene,
}: {
  modelPath: string;
  scene: Scene | null;
}) => {
  const keyboardControls = useKeyboardControls();
  const [model, setModel] = useState<Object3D | null>(null);
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
      const moveSpeed = 5.0; // units per second
      const rotationSpeed = 1.5; // radians per second

      if (forward) model.translateZ(-moveSpeed * delta);
      if (backward) model.translateZ(moveSpeed * delta);
      if (left) model.rotateY(rotationSpeed * delta);
      if (right) model.rotateY(-rotationSpeed * delta);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [model, keyboardControls]); // Dependency array now correctly includes 'model'

  return null;
};

export default Car;
