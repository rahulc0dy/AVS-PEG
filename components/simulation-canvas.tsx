"use client";

import { useEffect } from "react";
import { Camera, Scene, WebGLRenderer } from "three";
import { useWorld } from "@/components/hooks/use-world";
import { useWorldSimulation } from "@/components/hooks/use-world-simulation";
import { useMiniCamera } from "@/components/hooks/use-mini-camera";
import { MiniMapOverlay } from "@/components/world-ui/mini-map-overlay";
import { useTrafficDetector } from "@/components/hooks/use-traffic-detector";
import { ControlType } from "@/lib/car/controls";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { FpsMeter } from "@/components/ui/fps-meter";

interface SimulationCanvasProps {
  scene: Scene;
  camera: Camera;
  renderer: WebGLRenderer;
  dom: HTMLElement;
}

/**
 * Simulation canvas component for viewing the world in read-only mode.
 *
 * This component:
 * - Loads a saved world from localStorage
 * - Spawns standard traffic (human-controlled car + AI cars)
 * - Runs the simulation loop without editor tools
 * - Shows the mini camera view
 */
export default function SimulationCanvas({
  scene,
  camera,
  renderer,
  dom,
}: SimulationCanvasProps) {
  // Initialize the World instance (cars will be spawned after loading saved world)
  const { worldRef, world } = useWorld(scene, {
    showGrid: true,
  });

  // Run the simulation loop (no editors)
  useWorldSimulation(worldRef, camera, dom);

  const { scanTraffic, detections } = useTrafficDetector();

  useMiniCamera(renderer, scene, camera, worldRef, scanTraffic);

  // Load saved world on mount and spawn cars
  useEffect(() => {
    if (!world) return;

    // Try to load saved world from localStorage
    const saved = localStorage.getItem("avs-peg-world");
    if (saved) {
      try {
        const json = JSON.parse(saved);
        world.fromJson(json);
        world.generate();
        world.draw();
      } catch (e) {
        console.warn("Failed to load saved world:", e);
      }
    }

    // Spawn the human-controlled car
    world.generateTraffic(1, ControlType.HUMAN, {
      clearExisting: false,
      maxSpeed: 0.5,
    });

    // Add some AI traffic
    world.generateTraffic(5, ControlType.AI, {
      clearExisting: false,
      maxSpeed: 0.3,
    });
  }, [world]);

  useEffect(() => {
    if (detections.length > 0) {
      console.log("Traffic Light Found!", detections);
    }
  }, [detections]);

  return (
    <>
      <FpsMeter />
      <MiniMapOverlay />

      {/* Simple UI overlay */}
      <Card className="absolute bottom-4 right-4 z-10 w-64 border-zinc-700 bg-zinc-900 text-zinc-50">
        <CardHeader className="pb-2">
          <CardTitle className="text-zinc-50">Simulation Mode</CardTitle>
          <CardDescription className="text-zinc-400">
            Use WASD or Arrow keys to drive. Mouse to orbit camera.
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Navigation links */}
      <div className="absolute top-4 right-4 z-10 flex gap-2">
        <a
          href="/edit"
          className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-300 h-9 px-4 py-2 border border-zinc-700 bg-zinc-900 text-zinc-50 shadow-sm hover:bg-zinc-800"
        >
          Editor
        </a>
        <a
          href="/train"
          className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-300 h-9 px-4 py-2 bg-zinc-50 text-zinc-900 shadow hover:bg-zinc-200"
        >
          Training
        </a>
      </div>
    </>
  );
}
