"use client";

import { useEffect, useCallback, useState, useRef } from "react";
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
import type { NeuralNetworkJson } from "@/lib/ai/network";

/** LocalStorage key for the best brain */
const BEST_BRAIN_KEY = "avs-peg-best-brain";

/** Data structure for saved brain */
interface SavedBrain {
  timestamp: number;
  brainJson: NeuralNetworkJson;
  fitness: number;
  generation: number;
}

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

  // Ref to track the loaded brain for spawning
  const loadedBrainRef = useRef<NeuralNetworkJson | null>(null);

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

    // Try to load saved brain
    const savedBrain = localStorage.getItem(BEST_BRAIN_KEY);
    if (savedBrain) {
      try {
        const brainData: SavedBrain = JSON.parse(savedBrain);

        // Validate brain architecture matches current expected input count
        // Current: rayCount (10) + 4 navigation features = 14 inputs
        const expectedInputs = 14; // 10 rays + 4 features (lateral, along, angleDiff, distance)
        const brainInputs = brainData.brainJson.levels[0]?.inputs?.length ?? 0;

        if (brainInputs !== expectedInputs) {
          console.warn(
            `Saved brain has incompatible architecture (${brainInputs} inputs, expected ${expectedInputs}). Discarding.`,
          );
          localStorage.removeItem(BEST_BRAIN_KEY);
        } else {
          loadedBrainRef.current = brainData.brainJson;
          setGeneration(brainData.generation + 1);
          setBestFitness(brainData.fitness);
          console.log(
            `Loaded brain from generation ${brainData.generation} with fitness ${brainData.fitness.toFixed(4)}`,
          );
        }
      } catch (e) {
        console.warn("Failed to load saved brain:", e);
      }
    }
  }, [world]);

  // Update fitness stats periodically
  useEffect(() => {
    if (!isTraining) return;

    const interval = setInterval(() => {
      const world = worldRef.current;
      if (!world || world.cars.length === 0) return;

      // Find best fitness and count cars that reached destination
      let best = 0;
      let reached = 0;
      for (const car of world.cars) {
        if (car.fitness > best) {
          best = car.fitness;
        }
        if (car.reachedDestination) {
          reached++;
        }
      }
      setBestFitness(best);
      setCarsReachedDestination(reached);
    }, 500);

    return () => clearInterval(interval);
  }, [isTraining, worldRef]);

  const handleSaveBrain = useCallback(async () => {
    const world = worldRef.current;
    if (!world || world.cars.length === 0) {
      alert("No cars to save brain from!");
      return;
    }

    // Find the best performing car
    // Priority: cars that reached destination, then by fitness
    let bestCar = world.cars[0];
    for (const car of world.cars) {
      // Prioritize cars that reached destination
      if (car.reachedDestination && !bestCar.reachedDestination) {
        bestCar = car;
        continue;
      }
      if (!car.reachedDestination && bestCar.reachedDestination) {
        continue;
      }
      // Both reached or both didn't - compare fitness
      if (car.fitness > bestCar.fitness) {
        bestCar = car;
      }
    }

    console.log(
      `Best car: ${bestCar.id}, fitness: ${bestCar.fitness.toFixed(4)}, reached: ${bestCar.reachedDestination}`,
    );

    // Get the brain from the best car
    const brainJson = await bestCar.getBrain();
    if (!brainJson) {
      alert("Failed to get brain from best car!");
      return;
    }

    // Save to localStorage
    const savedBrain: SavedBrain = {
      timestamp: Date.now(),
      brainJson,
      fitness: bestCar.fitness,
      generation,
    };

    localStorage.setItem(BEST_BRAIN_KEY, JSON.stringify(savedBrain));
    loadedBrainRef.current = brainJson;

    const message = bestCar.reachedDestination
      ? `Brain saved! Car reached destination. Generation: ${generation}, Fitness: ${bestCar.fitness.toFixed(4)}`
      : `Brain saved! Generation: ${generation}, Fitness: ${bestCar.fitness.toFixed(4)}`;

    alert(message);
  }, [worldRef, generation]);

  const handleDiscardBrain = useCallback(() => {
    localStorage.removeItem(BEST_BRAIN_KEY);
    loadedBrainRef.current = null;
    setGeneration(1);
    setBestFitness(0);
    alert("Saved brain discarded!");
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
    const world = worldRef.current;
    if (!world) return;

    const source = world.markings.find((m) => m.type === "source");
    const sourcePos = source
      ? new Vector2(source.position.x, source.position.y)
      : undefined;

    const pathEdges = world.pathFindingSystem.getPath();
    const destinationPosition = getDestinationPosition();

    const spawnOptions = {
      maxSpeed: 0.5,
      brainJson: loadedBrainRef.current ?? undefined,
      mutationAmount: loadedBrainRef.current ? mutationAmount : undefined,
      destinationPosition,
    };

    if (stackSpawnAtSource) {
      world.spawnerSystem.spawnCarsAtSource(
        carCount,
        ControlType.AI,
        sourcePos,
        spawnOptions,
        pathEdges,
      );
    } else {
      world.spawnerSystem.spawnCars(carCount, ControlType.AI, spawnOptions);
    }

    setCurrentCarCount(world.cars.length);
    setIsTraining(true);
    setCarsReachedDestination(0);
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

    world.spawnerSystem.clearCars();
    setCurrentCarCount(0);
    setIsTraining(false);
    setCarsReachedDestination(0);
  }, [worldRef]);

  const handleResetCars = useCallback(() => {
    const world = worldRef.current;
    if (!world) return;

    const source = world.markings.find((m) => m.type === "source");
    const sourcePos = source
      ? new Vector2(source.position.x, source.position.y)
      : undefined;

    const pathEdges = world.pathFindingSystem.getPath();
    const destinationPosition = getDestinationPosition();

    // Increment generation on reset
    setGeneration((g) => g + 1);

    const spawnOptions = {
      maxSpeed: 0.5,
      brainJson: loadedBrainRef.current ?? undefined,
      mutationAmount: loadedBrainRef.current ? mutationAmount : undefined,
      destinationPosition,
    };

    if (stackSpawnAtSource) {
      world.spawnerSystem.resetCarsAtSource(
        carCount,
        ControlType.AI,
        sourcePos,
        spawnOptions,
        pathEdges,
      );
    } else {
      world.spawnerSystem.resetCars(carCount, ControlType.AI, spawnOptions);
    }

    setCurrentCarCount(world.cars.length);
    setCarsReachedDestination(0);
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
    setCurrentCarCount(0);
    setIsTraining(false);
    setCarsReachedDestination(0);
  }, [loadFromJson]);

  return (
    <>
      <FpsMeter />
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

          <div className="text-sm text-zinc-400 border-t border-zinc-700 pt-3 space-y-1">
            <p>Status: {isTraining ? "Training..." : "Ready"}</p>
            <p>Generation: {generation}</p>
            <p>Cars: {currentCarCount}</p>
            <p>Best Fitness: {(bestFitness ?? 0).toFixed(4)}</p>
            <p>Reached Destination: {carsReachedDestination}</p>
            <p>
              Brain:{" "}
              {loadedBrainRef.current ? "Loaded ✓" : "None (random start)"}
            </p>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
