"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Camera, Scene } from "three";
import { useWorld } from "@/components/hooks/use-world";
import { useWorldSimulation } from "@/components/hooks/use-world-simulation";
import { useWorldPersistence } from "@/components/hooks/use-world-persistence";
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
import {
  NetworkConfig,
  getNetworkInputLabels,
  getNetworkOutputLabels,
} from "@/lib/car/network-config";
import { useWorldInput } from "@/components/hooks/use-world-input";
import { Node } from "@/lib/primitives/node";

/** Local storage key for saved brain */
const BRAIN_STORAGE_KEY = "avs-peg-saved-brain";

interface TrainingCanvasProps {
  scene: Scene;
  camera: Camera;
  dom: HTMLElement;
}

/**
 * Collapsible section wrapper for organizing the training panel.
 */
function PanelSection({
  title,
  children,
  defaultOpen = true,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-zinc-700/30">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full cursor-pointer items-center justify-between px-5 py-2.5 transition-colors hover:bg-zinc-800/50"
      >
        <span className="text-[10px] font-semibold tracking-wider text-zinc-500 uppercase">
          {title}
        </span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`text-zinc-600 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && <div className="px-5 pb-3.5">{children}</div>}
    </div>
  );
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
  const [stackSpawnAtSource, setStackSpawnAtSource] = useState(true);
  const [spawnOnePerPath, setSpawnOnePerPath] = useState(false);
  const [mutationAmount, setMutationAmount] = useState(0.0);
  const [isTraining, setIsTraining] = useState(false);
  const [currentCarCount, setCurrentCarCount] = useState(0);
  const [generation, setGeneration] = useState(1);
  const [bestFitness, setBestFitness] = useState(0);
  const [carsReachedDestination, setCarsReachedDestination] = useState(0);
  const [bestCarId, setBestCarId] = useState<string | null>(null);
  const [selectedCarId, setSelectedCarId] = useState<number | null>(null);
  const [hasLoadedBrain, setHasLoadedBrain] = useState(() => {
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

  /** Output labels derived from network config */
  const OUTPUT_LABELS = useMemo(() => getNetworkOutputLabels(), []);

  /** Input labels derived from the current network input count and network config. */
  const inputLabels = useMemo(() => {
    if (!bestCarBrain) return undefined;
    const rayCount =
      bestCarBrain.inputs.length -
      NetworkConfig.markings.length -
      NetworkConfig.telemetry.length;
    return getNetworkInputLabels(rayCount);
  }, [bestCarBrain]);

  // Initialize the World instance (no initial cars)
  const { worldRef, world } = useWorld(scene, { showGrid: true });

  const { toast } = useToast();

  // Run the simulation loop (no editors)
  useWorldSimulation(worldRef, camera, dom);

  const { loadFromJson } = useWorldPersistence(worldRef);
  const { updatePointer, getIntersectPoint } = useWorldInput(camera, dom);

  useEffect(() => {
    let isClicking = false;

    const handlePointerDown = (evt: PointerEvent) => {
      if (evt.button !== 0) return;
      isClicking = true;
    };

    const handlePointerMove = () => {
      isClicking = false;
    };

    const handlePointerUp = (evt: PointerEvent) => {
      // Only process primary (left) clicks
      // 0 = left, 1 = middle, 2 = right
      if (evt.button !== 0) return;

      if (!isClicking) return;

      const world = worldRef.current;
      if (!world) return;

      updatePointer(evt);
      const intersectPoint = getIntersectPoint();
      const pointerNode = new Node(intersectPoint.x, intersectPoint.z);

      let clickedCar: Car | null = null;

      // Reverse iteration so we pick top-most overlapping car if needed
      for (let i = world.cars.length - 1; i >= 0; i--) {
        const car = world.cars[i];
        if (car.polygon && car.polygon.containsNode(pointerNode)) {
          clickedCar = car;
          break;
        }
      }

      if (clickedCar) {
        setSelectedCarId(clickedCar.id);
        toast(`Selected Car ${clickedCar.id}`, "info");
      } else {
        // Deselect if click doesn't hit a car
        setSelectedCarId(null);
      }
    };

    dom.addEventListener("pointerdown", handlePointerDown);
    dom.addEventListener("pointermove", handlePointerMove);
    dom.addEventListener("pointerup", handlePointerUp);
    return () => {
      dom.removeEventListener("pointerdown", handlePointerDown);
      dom.removeEventListener("pointermove", handlePointerMove);
      dom.removeEventListener("pointerup", handlePointerUp);
    };
  }, [dom, camera, worldRef, updatePointer, getIntersectPoint, toast]);

  useEffect(() => {
    if (!world) return;

    world.cars.forEach((car) => {
      car.setHighlighted(car.id === selectedCarId);
    });
  }, [world, selectedCarId, world?.cars.length]);

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

      const targetCarId = selectedCarId ?? stats.bestCarId;

      const currentTargetCar =
        targetCarId === null
          ? null
          : (cars.find((car) => car.id === targetCarId) ?? null);

      setBestCar(currentTargetCar);
      setBestCarBrain(currentTargetCar?.network ?? null);

      // Deselect if car is gone
      if (
        selectedCarId !== null &&
        !cars.some((car) => car.id === selectedCarId)
      ) {
        setSelectedCarId(null);
      }

      if (stats.isGenerationComplete) {
        // May do something in future
      }
    }, 100);

    return () => clearInterval(intervalId);
  }, [isTraining, world, selectedCarId]);

  const handleSaveBrain = useCallback(async () => {
    if (selectedCarId === null) {
      toast("No car selected. Please select a car to save its brain.", "error");
      return;
    }

    if (!bestCarBrain) {
      toast("No brain to save for the selected car.", "error");
      return;
    }

    try {
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
      toast(`Brain saved to local storage.`, "success");
    } catch (e) {
      console.error("Could not save brain to localStorage", e);
      toast("Failed to save brain. Storage may be full.", "error");
    }
  }, [bestCarBrain, toast, selectedCarId]);

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

    if (spawnOnePerPath) {
      const paths = world.pathFindingSystem.getPaths();
      if (paths.length === 0) {
        toast("No valid paths found.", "error");
        return;
      }

      world.spawnerSystem.spawnCarsAtPaths(
        paths,
        ControlType.AI,
        baseBrain,
        mutationAmount,
      );
    } else if (stackSpawnAtSource) {
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
  }, [
    worldRef,
    carCount,
    stackSpawnAtSource,
    spawnOnePerPath,
    mutationAmount,
    toast,
  ]);

  const handleClearCars = useCallback(() => {
    const world = worldRef.current;
    if (!world) return;

    world.spawnerSystem.clearCars();
    world.trainingSystem.stopTraining();
    world.trainingSystem.clearProgress();
    setBestCarId(null);
    setSelectedCarId(null);
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
      setSelectedCarId(null);
      setBestFitness(0);
      setGeneration(0);
      setCurrentCarCount(0);
      setIsTraining(false);
      setCarsReachedDestination(0);
    });
  }, [loadFromJson, worldRef]);

  return (
    <>
      <div
        className="absolute top-16 left-4 z-10 w-[19rem]"
        style={{ animation: "guide-enter 0.3s ease-out" }}
      >
        <div className="overflow-hidden rounded-2xl border border-zinc-700/50 bg-zinc-900/95 shadow-2xl backdrop-blur-xl">
          {/* Header */}
          <div className="border-b border-zinc-700/40 px-5 py-3.5">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/15">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-violet-400"
                >
                  <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-zinc-100">
                  Training Mode
                </h3>
                <p className="text-[11px] text-zinc-500">
                  AI agent evolution &amp; training
                </p>
              </div>
              {isTraining && (
                <span
                  className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400"
                  style={{
                    animation: "status-pulse 2s ease-in-out infinite",
                  }}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  Live
                </span>
              )}
            </div>
          </div>

          {/* Spawn Configuration */}
          <PanelSection title="Spawn Config">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Label htmlFor="carCount" className="shrink-0 text-xs text-zinc-400">
                  Cars
                </Label>
                <Input
                  id="carCount"
                  type="number"
                  min={1}
                  max={500}
                  value={carCount}
                  disabled={spawnOnePerPath}
                  onChange={(e) => setCarCount(Number(e.target.value))}
                  className="h-7 w-20 border-zinc-700/60 bg-zinc-800/80 text-center text-xs text-zinc-50 disabled:opacity-50"
                />
              </div>
              <div className="flex items-center gap-3">
                <Label htmlFor="mutationAmount" className="shrink-0 text-xs text-zinc-400">
                  Mutation
                </Label>
                <Input
                  id="mutationAmount"
                  type="number"
                  min={0}
                  max={1}
                  step={0.05}
                  value={mutationAmount}
                  onChange={(e) => setMutationAmount(Number(e.target.value))}
                  className="h-7 w-20 border-zinc-700/60 bg-zinc-800/80 text-center text-xs text-zinc-50"
                />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-zinc-400">
                    Stack at source
                  </Label>
                  <Checkbox
                    checked={stackSpawnAtSource}
                    disabled={spawnOnePerPath}
                    onChange={(e) => setStackSpawnAtSource(e.target.checked)}
                    aria-label="Stack spawn cars at source"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-zinc-400">
                    One per path
                  </Label>
                  <Checkbox
                    checked={spawnOnePerPath}
                    onChange={(e) => setSpawnOnePerPath(e.target.checked)}
                    aria-label="Spawn one car per path"
                  />
                </div>
              </div>
            </div>
          </PanelSection>

          {/* Training Actions */}
          <PanelSection title="Actions">
            <div className="space-y-1.5">
              <div className="flex gap-1.5">
                <Button
                  className="flex-1 text-xs"
                  size="sm"
                  onClick={handleSpawnCars}
                  disabled={isTraining}
                >
                  Spawn
                </Button>
                <Button
                  className="flex-1 text-xs"
                  size="sm"
                  onClick={handleNextGeneration}
                  disabled={!isTraining}
                >
                  Next Gen
                </Button>
                <Button
                  className="flex-1 text-xs"
                  size="sm"
                  variant="outline"
                  onClick={handleClearCars}
                  disabled={!isTraining}
                >
                  Clear
                </Button>
              </div>
              <Button
                className="w-full text-xs"
                size="sm"
                variant="outline"
                onClick={handleLoadWorld}
              >
                Load World
              </Button>
            </div>
          </PanelSection>

          {/* Brain Management */}
          <PanelSection title="Brain" defaultOpen={false}>
            <div className="grid grid-cols-2 gap-1.5">
              <Button
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={handleSaveBrain}
              >
                Save
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={handleExportBrain}
              >
                Export
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={handleImportBrain}
              >
                Import
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={handleDiscardBrain}
              >
                Discard
              </Button>
            </div>
            <div className="mt-2 flex items-center gap-1.5">
              <span
                className={`h-1.5 w-1.5 rounded-full ${hasLoadedBrain ? "bg-emerald-400" : "bg-zinc-600"}`}
              />
              <span className="text-[11px] text-zinc-500">
                {hasLoadedBrain ? "Brain loaded ✓" : "No saved brain"}
              </span>
            </div>
          </PanelSection>

          {/* Statistics */}
          <PanelSection title="Statistics">
            <div className="space-y-1">
              {[
                {
                  label: "Generation",
                  value: generation,
                },
                {
                  label: "Cars",
                  value: currentCarCount,
                },
                {
                  label: "Best Fitness",
                  value: (bestFitness ?? 0).toFixed(4),
                },
                {
                  label: "Best Car",
                  value: bestCarId ?? "—",
                },
                ...(selectedCarId !== null
                  ? [{ label: "Selected", value: selectedCarId }]
                  : []),
                {
                  label: "Reached Dest.",
                  value: carsReachedDestination,
                },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="flex items-center justify-between py-0.5"
                >
                  <span className="text-[11px] text-zinc-500">
                    {stat.label}
                  </span>
                  <span className="font-mono text-[11px] font-medium text-zinc-300">
                    {stat.value}
                  </span>
                </div>
              ))}
            </div>
          </PanelSection>

          {/* Controls Guide */}
          <div className="px-5 py-3">
            <p className="mb-1.5 text-[10px] font-semibold tracking-wider text-zinc-600 uppercase">
              Controls
            </p>
            <div className="space-y-1 text-[11px] text-zinc-500">
              <p>
                <kbd className="rounded border border-zinc-700 bg-zinc-800 px-1 py-0.5 text-[10px] text-zinc-400">
                  Left Click
                </kbd>{" "}
                on car to select
              </p>
              <p>Click empty space to deselect</p>
              <p>Drag / right-click to orbit camera</p>
            </div>
          </div>
        </div>
      </div>

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
