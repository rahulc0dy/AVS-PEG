"use client";

import { useCallback, useState } from "react";
import { Camera, Scene, Vector2 } from "three";
import { useWorld } from "@/components/hooks/use-world";
import { useWorldSimulation } from "@/components/hooks/use-world-simulation";
import { useWorldPersistence } from "@/components/hooks/use-world-persistence";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Button from "@/components/ui/button";
import Input from "@/components/ui/input";
import Label from "@/components/ui/label";
import Checkbox from "@/components/ui/checkbox";

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
 * - Tracks which car performs best (highest fitness / reached destination)
 * - Provides controls for saving/loading AI brains
 * - Applies mutations to create variations of the best brain
 * - Runs the simulation loop
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
  const [showNeuralNetwork, setShowNeuralNetwork] = useState(true);

  // Initialize the World instance (no initial cars)
  const { worldRef, world } = useWorld(scene, { showGrid: true });

  // Run the simulation loop (no editors)
  useWorldSimulation(worldRef, camera, dom);

  const { loadFromJson } = useWorldPersistence(worldRef);

  // Load saved world on mount (but don't spawn cars yet)

  // TODO: Update fitness stats and neural network state periodically

  const handleSaveBrain = useCallback(async () => {
    // TODO: Brain save to local storage
  }, [worldRef, generation]);

  const handleExportBrain = useCallback(async () => {
    // TODO: Brain export logic
  }, [worldRef, generation]);

  const handleImportBrain = useCallback(async () => {
    // TODO: Brain import logic
  }, []);

  const handleDiscardBrain = useCallback(() => {
    // TODO: Discard brain logic
  }, []);

  const getDestinationPosition = useCallback((): Vector2 | undefined => {
    const world = worldRef.current;
    if (!world) return undefined;

    const destination = world.markings.find((m) => m.type === "destination");
    return destination
      ? new Vector2(destination.position.x, destination.position.y)
      : undefined;
  }, [worldRef]);

  const handleSpawnCars = useCallback(() => {
    // TODO: Car spawning
  }, [
    worldRef,
    carCount,
    stackSpawnAtSource,
    mutationAmount,
    getDestinationPosition,
  ]);

  const handleClearCars = useCallback(() => {
    const world = worldRef.current;
    if (!world) return;

    // TODO: Clear cars
  }, [worldRef]);

  const handleResetCars = useCallback(() => {
    // TODO: Reset cars
  }, [
    worldRef,
    carCount,
    stackSpawnAtSource,
    mutationAmount,
    getDestinationPosition,
  ]);

  const handleLoadWorld = useCallback(() => {
    loadFromJson();
    // Reset training state since loading clears all cars
    const world = worldRef.current;
    // TODO: Clear bestcar
    // if (world) world.bestCarId = null;
    setBestCarId(null);
    setCurrentCarCount(0);
    setIsTraining(false);
    setCarsReachedDestination(0);
  }, [loadFromJson, worldRef]);

  return (
    <>
      <Card className="absolute top-12 left-4 z-10 w-72 border-zinc-700 bg-zinc-900 text-zinc-50">
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

          <div className="flex items-center justify-between gap-3">
            <Label className="text-zinc-400">Stack spawn at Source</Label>
            <Checkbox
              checked={stackSpawnAtSource}
              onChange={(e) => setStackSpawnAtSource(e.target.checked)}
              aria-label="Stack spawn cars at source"
            />
          </div>

          <div className="flex items-center justify-between gap-3">
            <Label className="text-zinc-400">Show Neural Network</Label>
            <Checkbox
              checked={showNeuralNetwork}
              onChange={(e) => setShowNeuralNetwork(e.target.checked)}
              aria-label="Show neural network visualization"
            />
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

      {/* Neural Network Visualizer */}
      {showNeuralNetwork && isTraining && (
        <Card className="absolute top-12 right-4 z-10 border-zinc-700 bg-zinc-900 text-zinc-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-zinc-50 text-sm">
              Best Car Neural Network
              {bestCarId && (
                <span className="text-zinc-400 font-normal ml-2">
                  ({bestCarId})
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-2">
            {/*  TODO: Neural Network Visualiser */}
          </CardContent>
        </Card>
      )}
    </>
  );
}
