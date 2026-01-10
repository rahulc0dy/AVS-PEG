"use client";

import { useEffect, useCallback, useState } from "react";
import { Camera, Scene, Vector2 } from "three";
import { useWorld } from "@/components/hooks/use-world";
import { useWorldSimulation } from "@/components/hooks/use-world-simulation";
import { useWorldPersistence } from "@/components/hooks/use-world-persistence";
import { ControlType } from "@/lib/car/controls";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Button from "@/components/ui/button";
import Input from "@/components/ui/input";
import Label from "@/components/ui/label";
import Checkbox from "@/components/ui/checkbox";
import { FpsMeter } from "@/components/ui/fps-meter";

interface TrainingCanvasProps {
  scene: Scene;
  camera: Camera;
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
  dom,
}: TrainingCanvasProps) {
  const [carCount, setCarCount] = useState(10);
  const [isTraining, setIsTraining] = useState(false);
  const [currentCarCount, setCurrentCarCount] = useState(0);
  const [stackSpawnAtSource, setStackSpawnAtSource] = useState(false);

  // Initialize the World instance (no initial cars)
  const { worldRef, world } = useWorld(scene, { showGrid: true });

  // Run the simulation loop (no editors)
  useWorldSimulation(worldRef, camera, dom);

  const { loadFromJson } = useWorldPersistence(worldRef);

  // Load saved world on mount (but don't spawn cars yet)
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
  }, [world]);

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
        carPosition: { x: bestCar.position.x, y: bestCar.position.y },
        // In a real implementation: bestCar.brain.toJSON()
      }),
    );

    alert("Brain saved! (placeholder)");
  }, [worldRef]);

  const handleSpawnCars = useCallback(() => {
    const world = worldRef.current;
    if (!world) return;

    const source = world.markings.find((m) => m.type === "source");
    const sourcePos = source
      ? new Vector2(source.position.x, source.position.y)
      : undefined;

    const pathEdges = world.pathFindingSystem.getPath();

    if (stackSpawnAtSource) {
      world.spawnerSystem.spawnCarsAtSource(
        carCount,
        ControlType.AI,
        sourcePos,
        {
          maxSpeed: 0.5,
        },
        pathEdges,
      );
    } else {
      // current behavior
      world.spawnerSystem.spawnCars(carCount, ControlType.AI, {
        maxSpeed: 0.5,
      });
    }

    setCurrentCarCount(world.cars.length);
    setIsTraining(true);
  }, [worldRef, carCount, stackSpawnAtSource]);

  const handleClearCars = useCallback(() => {
    const world = worldRef.current;
    if (!world) return;

    // Clear all cars using SpawnerSystem
    world.spawnerSystem.clearCars();
    setCurrentCarCount(0);
    setIsTraining(false);
  }, [worldRef]);

  const handleResetCars = useCallback(() => {
    const world = worldRef.current;
    if (!world) return;

    const source = world.markings.find((m) => m.type === "source");
    const sourcePos = source
      ? new Vector2(source.position.x, source.position.y)
      : undefined;

    const pathEdges = world.pathFindingSystem.getPath();

    if (stackSpawnAtSource) {
      world.spawnerSystem.resetCarsAtSource(
        carCount,
        ControlType.AI,
        sourcePos,
        {
          maxSpeed: 0.5,
        },
        pathEdges,
      );
    } else {
      // current behavior
      world.spawnerSystem.resetCars(carCount, ControlType.AI, {
        maxSpeed: 0.5,
      });
    }

    setCurrentCarCount(world.cars.length);
  }, [worldRef, carCount, stackSpawnAtSource]);

  const handleLoadWorld = useCallback(() => {
    loadFromJson();
    // Reset training state since loading clears all cars
    setCurrentCarCount(0);
    setIsTraining(false);
  }, [loadFromJson]);

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
            <Button onClick={handleSpawnCars} disabled={isTraining}>
              Spawn Cars
            </Button>
            <Button onClick={handleResetCars} disabled={!isTraining}>
              Reset Cars
            </Button>
            <Button onClick={handleClearCars} disabled={!isTraining}>
              Clear Cars
            </Button>
            <Button variant="outline" onClick={handleSaveBrain}>
              Save Best Brain
            </Button>
            <Button variant="outline" onClick={handleLoadWorld}>
              Load World
            </Button>
          </div>

          <div className="flex items-center justify-between gap-3">
            <Label className="text-zinc-400">Stack spawn at Source</Label>
            <Checkbox
              checked={stackSpawnAtSource}
              onChange={(e) => setStackSpawnAtSource(e.target.checked)}
              aria-label="Stack spawn cars at source"
            />
          </div>

          <div className="text-sm text-zinc-400 border-t border-zinc-700 pt-3">
            <p>Status: {isTraining ? "Training..." : "Ready"}</p>
            <p>Cars: {currentCarCount}</p>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
