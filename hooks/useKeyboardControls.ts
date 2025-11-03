"use client";

import { useEffect, useRef } from "react";

export const useKeyboardControls = () => {
  const keys = useRef({
    forward: false,
    backward: false,
    left: false,
    right: false,
  });

  useEffect(() => {
    const keyMap = [
      { name: "forward", keys: ["ArrowUp", "w", "W"] },
      { name: "backward", keys: ["ArrowDown", "s", "S"] },
      { name: "left", keys: ["ArrowLeft", "a", "A"] },
      { name: "right", keys: ["ArrowRight", "d", "D"] },
    ];

    const handleKeyDown = (e: KeyboardEvent) => {
      const key = keyMap.find((k) => k.keys.includes(e.key));
      if (key) {
        keys.current[key.name as keyof typeof keys.current] = true;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = keyMap.find((k) => k.keys.includes(e.key));
      if (key) {
        keys.current[key.name as keyof typeof keys.current] = false;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  return keys;
};
