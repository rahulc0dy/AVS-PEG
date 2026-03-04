"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
import { NeuralNetworkVisualizer } from "@/components/world-ui/neural-network-visualizer";
import { NeuralNetworkStateJson } from "@/types/car/state";
import { NeuralNetworkJson } from "@/types/save";
import { Car } from "@/lib/car/car";
import { NeuralNetwork } from "@/lib/ai/network";

/** Local storage key for saved brain */
const BRAIN_STORAGE_KEY = "avs-peg-saved-brain";

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
  const [hasLoadedBrain, setHasLoadedBrain] = useState(() => {
    // Check for saved brain on initial render
    if (typeof window === "undefined") return false;
    try {
      const savedBrain = localStorage.getItem(BRAIN_STORAGE_KEY);
      if (savedBrain) {
        const brainJson = JSON.parse(savedBrain) as NeuralNetworkJson;
        NeuralNetwork.fromJson(brainJson);
        return true;
      }
    } catch (e) {
      console.warn("Could not load saved brain from localStorage", e);
      localStorage.removeItem(BRAIN_STORAGE_KEY);
    }
    return false;
  });
  const [bestCarBrain, setBestCarBrain] =
    useState<NeuralNetworkStateJson | null>(null);
  const [bestCar, setBestCar] = useState<Car | null>(null);

  /** Output labels corresponding to the 4 car control outputs. */
  const OUTPUT_LABELS = ["Forward", "Left", "Right", "Reverse"];

  /** Input labels derived from the current network input count. */
  const inputLabels = useMemo(() => {
    if (!bestCarBrain) return undefined;
    const inputCount = bestCarBrain.inputs.length;
    const labels: string[] = [];
    // All inputs except the last one are sensor rays
    for (let i = 0; i < inputCount - 1; i++) {
      labels.push(`Ray ${i + 1}`);
    }
    // Last input is normalized speed
    labels.push("Speed");
    return labels;
  }, [bestCarBrain]);

  // Initialize the World instance (no initial cars)
  const { worldRef, world } = useWorld(scene, { showGrid: true });

  const { toast } = useToast();

  // Run the simulation loop (no editors)
  useWorldSimulation(worldRef, camera, dom);

  const { loadFromJson } = useWorldPersistence(worldRef);

  /**
   * Track the best car and update fitness statistics.
   * Runs continuously while training is active.
   */
  useEffect(() => {
    if (!isTraining || !world) return;

    const intervalId = setInterval(() => {
      const training = world.trainingSystem;
      const cars = world.cars;

      if (cars.length === 0) return;

      const stats = training.getStats(cars);

      setCarsReachedDestination(stats.numOfCarsReachedDestination);
      setBestFitness(stats.bestFitness);
      setBestCarId(stats.bestCarId?.toString() ?? null);
      const currentBestCar =
        stats.bestCarId === null
          ? null
          : (cars.find((car) => car.id === stats.bestCarId) ?? null);
      setBestCar(currentBestCar);
      setBestCarBrain(currentBestCar?.network ?? null);

      if (stats.isGenerationComplete) {
        // May do something in future
      }
    }, 100);

    return () => clearInterval(intervalId);
  }, [isTraining, world]);

  const handleSaveBrain = useCallback(async () => {
    if (!bestCarBrain) {
      toast("No best car brain to save. Spawn cars first.", "error");
      return;
    }

    try {
      // Convert NeuralNetworkStateJson to NeuralNetworkJson format
      const brainJson: NeuralNetworkJson = {
        levels: bestCarBrain.levels.map((level) => ({
          inputCount: level.inputs.length,
          outputCount: level.outputs.length,
          biases: level.biases,
          weights: level.weights,
        })),
      };

      localStorage.setItem(BRAIN_STORAGE_KEY, JSON.stringify(brainJson));
      setHasLoadedBrain(true);
      toast("Best brain saved to local storage.", "success");
    } catch (e) {
      console.error("Could not save brain to localStorage", e);
      toast("Failed to save brain. Storage may be full.", "error");
    }
  }, [bestCarBrain, toast]);

  const handleExportBrain = useCallback(async () => {
    try {
      const brainStr = localStorage.getItem(BRAIN_STORAGE_KEY);
      if (!brainStr) {
        toast("No saved brain to export. Save a brain first.", "error");
        return;
      }

      const blob = new Blob([brainStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `avs-brain-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast("Brain exported successfully.", "success");
    } catch (e) {
      console.error("Could not export brain", e);
      toast("Failed to export brain.", "error");
    }
  }, [toast]);

  const handleImportBrain = useCallback(async () => {
    try {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".json";
      input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) return;

        try {
          const text = await file.text();
          const brainJson = JSON.parse(text) as NeuralNetworkJson;

          // Validate the brain structure
          if (!brainJson.levels || !Array.isArray(brainJson.levels)) {
            toast("Invalid brain file format.", "error");
            return;
          }

          // Verify we can create a neural network from it
          NeuralNetwork.fromJson(brainJson);

          localStorage.setItem(BRAIN_STORAGE_KEY, JSON.stringify(brainJson));
          setHasLoadedBrain(true);
          toast("Brain imported and saved to local storage.", "success");
        } catch (parseError) {
          console.error("Could not parse brain file", parseError);
          toast(
            "Invalid brain file. Please select a valid JSON file.",
            "error",
          );
        }
      };
      input.click();
    } catch (e) {
      console.error("Could not import brain", e);
      toast("Failed to import brain.", "error");
    }
  }, [toast]);

  const handleDiscardBrain = useCallback(() => {
    try {
      localStorage.removeItem(BRAIN_STORAGE_KEY);
      setHasLoadedBrain(false);
      toast("Saved brain discarded.", "info");
    } catch (e) {
      console.error("Could not discard brain", e);
      toast("Failed to discard brain.", "error");
    }
  }, [toast]);

  /**
   * Handle weight change from the neural network visualizer.
   * Updates the best car's neural network weight.
   */
  const handleWeightChange = useCallback(
    (layerIdx: number, fromIdx: number, toIdx: number, value: number) => {
      if (bestCar) {
        bestCar.updateWeight(layerIdx, fromIdx, toIdx, value);
      }
    },
    [bestCar],
  );

  /**
   * Handle bias change from the neural network visualizer.
   * Updates the best car's neural network bias.
   */
  const handleBiasChange = useCallback(
    (layerIdx: number, neuronIdx: number, value: number) => {
      if (bestCar) {
        bestCar.updateBias(layerIdx, neuronIdx, value);
      }
    },
    [bestCar],
  );

  const handleSpawnCars = useCallback(() => {
    const world = worldRef.current;
    if (!world) return;

    if (world.roads.length == 0) {
      toast("No roads in the world to spawn cars on.", "error");
      return;
    }

    // Get saved brain from localStorage if available
    let baseBrain: NeuralNetworkJson | undefined;
    try {
      const savedBrain = localStorage.getItem(BRAIN_STORAGE_KEY);
      if (savedBrain) {
        baseBrain = JSON.parse(savedBrain) as NeuralNetworkJson;
      }
    } catch (e) {
      console.warn("Could not load saved brain for spawning", e);
    }

    if (stackSpawnAtSource) {
      const source = world.markings.find((m) => m.type === "source");
      const sourcePos = source ? source.position : undefined;

      if (!sourcePos) {
        toast("Source marking not found in the world.", "error");
        return;
      }

      const path = world.pathFindingSystem.getPath();
      if (path.length === 0) {
        toast("No valid path found from source to destination.", "error");
        return;
      } else {
        world.spawnerSystem.spawnCarsAtSource(
          carCount,
          ControlType.AI,
          sourcePos,
          path,
          baseBrain,
          mutationAmount,
        );
      }
    } else {
      world.spawnerSystem.spawnCars(
        carCount,
        ControlType.AI,
        baseBrain,
        mutationAmount,
      );
    }

    const spawnedCount = world.cars.length;
    if (spawnedCount > 0) {
      toast(
        `Successfully spawned ${spawnedCount} cars.${baseBrain ? " Using saved brain with mutation." : ""}`,
        "success",
      );
      world.trainingSystem.startTraining();
      setGeneration(world.trainingSystem.getGeneration());
    } else {
      toast("Could not spawn any cars. Ensure there are roads.", "error");
      return;
    }

    setCurrentCarCount(spawnedCount);
    setIsTraining(true);
    setCarsReachedDestination(0);
  }, [worldRef, carCount, stackSpawnAtSource, mutationAmount, toast]);

  const handleClearCars = useCallback(() => {
    const world = worldRef.current;
    if (!world) return;

    world.spawnerSystem.clearCars();
    world.trainingSystem.stopTraining();
    world.trainingSystem.clearProgress();
    setBestCarId(null);
    setCurrentCarCount(0);
    setIsTraining(false);
    setCarsReachedDestination(0);
    toast("All cars cleared.", "info");
  }, [worldRef, toast]);

  const handleNextGeneration = useCallback(() => {
    const world = worldRef.current;
    if (!world) return;

    // Clear current cars but don't reset training system generation
    world.spawnerSystem.clearCars();
    world.trainingSystem.clearProgress();

    // Spawn new cars (this will increment generation)
    handleSpawnCars();

    const newGen = world.trainingSystem.getGeneration();
    toast(`Generation ${newGen} started.`, "info");
  }, [worldRef, handleSpawnCars, toast]);

  /**
   * Loads a world from JSON and resets training state.
   */
  const handleLoadWorld = useCallback(() => {
    loadFromJson(() => {
      const world = worldRef.current;
      if (world) {
        world.trainingSystem.reset();
      }
      setBestCarId(null);
      setBestFitness(0);
      setGeneration(0);
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
            <Button onClick={handleNextGeneration} disabled={!isTraining}>
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

      <NeuralNetworkVisualizer
        state={bestCarBrain}
        inputLabels={inputLabels}
        outputLabels={OUTPUT_LABELS}
        onWeightChange={handleWeightChange}
        onBiasChange={handleBiasChange}
      />
    </>
  );
}
