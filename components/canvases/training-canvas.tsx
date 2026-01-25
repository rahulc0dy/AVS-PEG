"use client";

import { useCallback, useState } from "react";
import { Camera, Scene } from "three";
import { useWorld } from "@/components/hooks/use-world";
import { useWorldSimulation } from "@/components/hooks/use-world-simulation";
import { useWorldPersistence } from "@/components/hooks/use-world-persistence";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Button from "@/components/ui/button";
import Input from "@/components/ui/input";
import Label from "@/components/ui/label";
import Checkbox from "@/components/ui/checkbox";
import { useToast } from "@/components/ui/toast";
import { ControlType } from "@/lib/car/controls";

interface TrainingCanvasProps {
  scene: Scene;
  camera: Camera;
  dom: HTMLElement;
}

/**
 * Training canvas component for AI agent training.
 *
 * Loads a saved world, spawns multiple AI-controlled cars, tracks performance,
 * and provides controls for saving/loading AI brains and applying mutations.
 */
export default function TrainingCanvas({
  scene,
  camera,
  dom,
}: TrainingCanvasProps) {
  const [carCount, setCarCount] = useState(10);
  const [mutationAmount, setMutationAmount] = useState(0.1);
  const [isTraining, setIsTraining] = useState(false);
  const [currentCarCount, setCurrentCarCount] = useState(0);
  const [stackSpawnAtSource, setStackSpawnAtSource] = useState(false);
  const [generation, setGeneration] = useState(1);
  const [bestFitness, setBestFitness] = useState(0);
  const [carsReachedDestination, setCarsReachedDestination] = useState(0);
  const [bestCarId, setBestCarId] = useState<string | null>(null);
  const [hasLoadedBrain, setHasLoadedBrain] = useState(false);

  // Initialize the World instance (no initial cars)
  const { worldRef, world } = useWorld(scene, { showGrid: true });

  const { toast } = useToast();

  // Run the simulation loop (no editors)
  useWorldSimulation(worldRef, camera, dom);

  const { loadFromJson } = useWorldPersistence(worldRef);

  const handleSaveBrain = useCallback(async () => {
    // TODO: Brain save to local storage
  }, []);

  const handleExportBrain = useCallback(async () => {
    // TODO: Brain export logic
  }, []);

  const handleImportBrain = useCallback(async () => {
    // TODO: Brain import logic
  }, []);

  const handleDiscardBrain = useCallback(() => {
    // TODO: Discard brain logic
  }, []);

  const handleSpawnCars = useCallback(() => {
    const world = worldRef.current;
    if (!world) return;

    if (stackSpawnAtSource) {
      const source = world.markings.find((m) => m.type === "source");
      const sourcePos = source ? source.position : undefined;

      if (!sourcePos) {
        toast("Source marking not found in the world.", "error");
        return;
      }

      world.spawnerSystem.spawnCarsAtSource(
        carCount,
        ControlType.AI,
        sourcePos,
        world.pathFindingSystem.getPath(),
      );
    } else {
      world.spawnerSystem.spawnCars(carCount, ControlType.AI);
    }

    const spawnedCount = world.cars.length;
    if (spawnedCount > 0) {
      toast(`Successfully spawned ${spawnedCount} cars.`, "success");
    } else {
      toast("Could not spawn any cars. Ensure there are roads.", "error");
      return;
    }

    setCurrentCarCount(spawnedCount);
    setIsTraining(true);
    setCarsReachedDestination(0);
  }, [worldRef, carCount, stackSpawnAtSource, toast]);

  const handleClearCars = useCallback(() => {
    const world = worldRef.current;
    if (!world) return;

    world.spawnerSystem.clearCars();
    setBestCarId(null);
    setCurrentCarCount(0);
    setIsTraining(false);
    setCarsReachedDestination(0);
    toast("All cars cleared.", "info");
  }, [worldRef, toast]);

  const handleResetCars = useCallback(() => {
    handleClearCars();
    handleSpawnCars();
    setGeneration((g) => g + 1);
    toast(`Generation ${generation + 1} started.`, "info");
  }, [handleClearCars, handleSpawnCars, generation, toast]);

  /**
   * Loads a world from JSON and resets training state.
   */
  const handleLoadWorld = useCallback(() => {
    loadFromJson(() => {
      // Reset training state since loading clears all cars
      const world = worldRef.current;
      if (world) {
        world.spawnerSystem.clearCars();
        world.generate();
      }
      setBestCarId(null);
      setBestFitness(0);
      setGeneration(1);
      setCurrentCarCount(0);
      setIsTraining(false);
      setCarsReachedDestination(0);
    });
  }, [loadFromJson, worldRef]);

  return (
    <>
      <Card className="absolute top-16 left-4 z-10 w-72 border-zinc-700 bg-zinc-900 text-zinc-50">
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

          <div className="flex items-center gap-3">
            <Label htmlFor="mutationAmount" className="text-zinc-400">
              Mutation:
            </Label>
            <Input
              id="mutationAmount"
              type="number"
              min={0}
              max={1}
              step={0.05}
              value={mutationAmount}
              onChange={(e) => setMutationAmount(Number(e.target.value))}
              className="w-20 h-8 border-zinc-700 bg-zinc-800 text-zinc-50 text-center"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Button onClick={handleSpawnCars} disabled={isTraining}>
              Spawn Cars
            </Button>
            <Button onClick={handleResetCars} disabled={!isTraining}>
              Next Generation
            </Button>
            <Button onClick={handleClearCars} disabled={!isTraining}>
              Clear Cars
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

          <div className="flex flex-col gap-2 border-t border-zinc-700 pt-3">
            <Button variant="outline" onClick={handleSaveBrain}>
              Save Best Brain
            </Button>
            <Button variant="outline" onClick={handleExportBrain}>
              Export Brain (JSON)
            </Button>
            <Button variant="outline" onClick={handleImportBrain}>
              Import Brain (JSON)
            </Button>
            <Button variant="outline" onClick={handleDiscardBrain}>
              Discard Saved Brain
            </Button>
            <Button variant="outline" onClick={handleLoadWorld}>
              Load World
            </Button>
          </div>

          <div className="text-sm text-zinc-400 border-t border-zinc-700 pt-3 space-y-1">
            <p>Status: {isTraining ? "Training..." : "Ready"}</p>
            <p>Generation: {generation}</p>
            <p>Cars: {currentCarCount}</p>
            <p>Best Fitness: {(bestFitness ?? 0).toFixed(4)}</p>
            <p>Best Car: {bestCarId ?? "—"}</p>
            <p>Reached Destination: {carsReachedDestination}</p>
            <p>Brain: {hasLoadedBrain ? "Loaded ✓" : "None (random start)"}</p>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
