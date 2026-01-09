"use client";

import { useEffect, useRef, useState } from "react";

interface FpsMeterProps {
  className?: string;
}

/**
 * A simple FPS (frames per second) meter component.
 * Displays the current frame rate updated every 500ms.
 */
export function FpsMeter({ className = "" }: FpsMeterProps) {
  const [fps, setFps] = useState(0);
  const frameCountRef = useRef(0);
  const lastTimeRef = useRef(performance.now());
  const rafIdRef = useRef<number>(0);

  useEffect(() => {
    const measureFps = () => {
      frameCountRef.current++;
      const now = performance.now();
      const elapsed = now - lastTimeRef.current;

      // Update FPS display every 500ms
      if (elapsed >= 500) {
        const currentFps = Math.round((frameCountRef.current * 1000) / elapsed);
        setFps(currentFps);
        frameCountRef.current = 0;
        lastTimeRef.current = now;
      }

      rafIdRef.current = requestAnimationFrame(measureFps);
    };

    rafIdRef.current = requestAnimationFrame(measureFps);

    return () => {
      cancelAnimationFrame(rafIdRef.current);
    };
  }, []);

  // Color based on FPS performance
  const getFpsColor = () => {
    if (fps >= 55) return "text-emerald-400";
    if (fps >= 30) return "text-yellow-400";
    return "text-red-400";
  };

  return (
    <div
      className={`fixed top-4 left-4 z-50 px-3 py-1.5 bg-zinc-900/90 border border-zinc-700 rounded-md text-xs font-mono ${className}`}
    >
      <span className="text-zinc-400">FPS: </span>
      <span className={getFpsColor()}>{fps}</span>
    </div>
  );
}

export default FpsMeter;
