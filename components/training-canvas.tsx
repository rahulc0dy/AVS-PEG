"use client";

import { useEffect, useCallback, useState } from "react";
import { Camera, Scene, WebGLRenderer } from "three";
import { useWorld } from "@/components/hooks/use-world";
import { useWorldSimulation } from "@/components/hooks/use-world-simulation";
import { useWorldPersistence } from "@/components/hooks/use-world-persistence";
import { ControlType } from "@/lib/car/controls";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Button from "@/components/ui/button";
import Input from "@/components/ui/input";
import Label from "@/components/ui/label";
import { FpsMeter } from "@/components/ui/fps-meter";

interface TrainingCanvasProps {
  scene: Scene;
  camera: Camera;
  renderer: WebGLRenderer;
  dom: HTMLElement;
}

/**
 * Training canvas component for AI agent training.
 *
 * This component:
 * - Loads a saved world from localStorage or defaults
 * - Spawns multiple AI-controlled cars
 * - Provides controls for saving/loading AI brains
 * - Runs the simulation loop
 */
export default function TrainingCanvas({
  scene,
  camera,
  renderer,
  dom,
}: TrainingCanvasProps) {
  const [carCount, setCarCount] = useState(100);
  const [isTraining, setIsTraining] = useState(false);

  // Initialize the World instance (no initial cars)
  const { worldRef, world } = useWorld(scene, { showGrid: true });

  // Run the simulation loop (no editors)
  useWorldSimulation(worldRef, camera, dom);

  const { loadFromJson } = useWorldPersistence(worldRef);

  // Load saved world and spawn training cars on mount
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

    // Spawn AI cars for training
    world.generateTraffic(carCount, ControlType.AI, {
      clearExisting: true,
      maxSpeed: 0.5,
    });

    setIsTraining(true);
  }, [world, carCount]);

  const handleSaveBrain = useCallback(() => {
    // Placeholder for brain saving logic
    // In a real implementation, this would save the neural network weights
    console.log("Saving best brain...");
    const world = worldRef.current;
    if (!world || world.cars.length === 0) return;

    // Find the best performing car (could be based on distance traveled, survival time, etc.)
    const bestCar = world.cars.reduce((best, car) => {
      // Simple heuristic: car that traveled the most
      const bestDist = Math.abs(best.position.x) + Math.abs(best.position.y);
      const carDist = Math.abs(car.position.x) + Math.abs(car.position.y);
      return carDist > bestDist ? car : best;
    });

    // Save brain to localStorage (placeholder)
    localStorage.setItem(
      "avs-peg-best-brain",
      JSON.stringify({
        timestamp: Date.now(),
        // In a real implementation: bestCar.brain.toJSON()
      }),
    );

    alert("Brain saved! (placeholder)");
  }, [worldRef]);

  const handleResetTraining = useCallback(() => {
    const world = worldRef.current;
    if (!world) return;

    // Regenerate cars
    world.generateTraffic(carCount, ControlType.AI, {
      clearExisting: true,
      maxSpeed: 0.5,
    });
  }, [worldRef, carCount]);

  const handleLoadWorld = useCallback(() => {
    loadFromJson();
    // After loading, regenerate cars
    setTimeout(() => {
      const world = worldRef.current;
      if (world) {
        world.generateTraffic(carCount, ControlType.AI, {
          clearExisting: true,
          maxSpeed: 0.5,
        });
      }
    }, 100);
  }, [loadFromJson, worldRef, carCount]);

  return (
    <>
      <FpsMeter />
      <Card className="absolute top-12 left-4 z-10 w-64 border-zinc-700 bg-zinc-900 text-zinc-50">
        <CardHeader className="pb-3">
          <CardTitle className="text-zinc-50">Training Mode</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Label htmlFor="carCount" className="text-zinc-400">
              Cars:
            </Label>
            <Input
              id="carCount"
              type="number"
              min={1}
              max={500}
              value={carCount}
              onChange={(e) => setCarCount(Number(e.target.value))}
              className="w-20 h-8 border-zinc-700 bg-zinc-800 text-zinc-50 text-center"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Button onClick={handleResetTraining}>Reset Training</Button>
            <Button variant="outline" onClick={handleSaveBrain}>
              Save Best Brain
            </Button>
            <Button variant="outline" onClick={handleLoadWorld}>
              Load World
            </Button>
          </div>

          <div className="text-sm text-zinc-400 border-t border-zinc-700 pt-3">
            <p>Status: {isTraining ? "Training..." : "Initializing..."}</p>
            <p>Cars: {worldRef.current?.cars.length ?? 0}</p>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
