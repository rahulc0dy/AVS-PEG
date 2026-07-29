"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Camera, Scene } from "three";
import Button from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useWorld } from "@/components/hooks/use-world";
import { useWorldSimulation } from "@/components/hooks/use-world-simulation";
import { useWorldPersistence } from "@/components/hooks/use-world-persistence";
import { ControlType } from "@/lib/car/controls";
import { Node } from "@/lib/primitives/node";
import { NeuralNetworkJson } from "@/types/save";
import { NeuralNetworkVisualizer } from "@/components/world-ui/neural-network-visualizer";
import { NeuralNetworkStateJson } from "@/types/car/state";
import { Car } from "@/lib/car/car";
import {
  getNetworkInputLabels,
  getNetworkOutputLabels,
  NetworkConfig,
} from "@/lib/car/network-config";

interface SimulationCanvasProps {
  scene: Scene;
  camera: Camera;
  dom: HTMLElement;
  /** Name of the currently loaded scenario (shown in HUD). */
  scenarioName?: string;
  /** URL of the world JSON to auto-load. If absent, user must load manually. */
  worldUrl?: string;
  /** Callback to navigate back to scenario selection. */
  onBackToScenarios?: () => void;
}

/**
 * Renders a styled keyboard key badge for control guides.
 */
function KeyBadge({ children }: { children: string }) {
  return (
    <kbd className="inline-flex min-w-[1.75rem] items-center justify-center rounded-md border border-zinc-600/80 bg-zinc-700/50 px-1.5 py-1 text-[11px] font-semibold text-zinc-300 shadow-sm">
      {children}
    </kbd>
  );
}

/**
 * Simulation canvas for running a loaded world with AI-driven cars.
 *
 * Responsibilities:
 * - Auto-load a scenario world JSON and shared brain from URLs.
 * - Spawn AI cars using the loaded brain (zero mutation).
 * - Provide play/pause, reset, and speed controls.
 * - Display a HUD with scenario info, car count, and destination stats.
 * - Integrate the neural network visualizer for the best/selected car.
 */
export default function SimulationCanvas({
  scene,
  camera,
  dom,
  scenarioName,
  worldUrl,
  onBackToScenarios,
}: SimulationCanvasProps) {
  const [hasPlayerCar, setHasPlayerCar] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [carCount, setCarCount] = useState(0);
  const [carsReachedDestination, setCarsReachedDestination] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [selectedCarId, setSelectedCarId] = useState<number | null>(null);
  const [bestCarBrain, setBestCarBrain] =
    useState<NeuralNetworkStateJson | null>(null);
  const [bestCar, setBestCar] = useState<Car | null>(null);
  const brainRef = useRef<NeuralNetworkJson | null>(null);
  const elapsedRef = useRef(0);
  const [worldLoaded, setWorldLoaded] = useState(false);

  // Create world and start simulation loop
  const { worldRef, world } = useWorld(scene, { showGrid: true });
  useWorldSimulation(worldRef, camera, dom);

  const { toast } = useToast();
  const { loadFromJson, loadWorldFromUrl, fetchBrain } =
    useWorldPersistence(worldRef);

  /** Output labels derived from network config */
  const OUTPUT_LABELS = useMemo(() => getNetworkOutputLabels(), []);

  /** Input labels derived from the current network input count and network config. */
  const inputLabels = useMemo(() => {
    if (!bestCarBrain) return undefined;
    const rayCount =
      (bestCarBrain.inputs.length -
        NetworkConfig.markings.length -
        NetworkConfig.telemetry.length) /
      2;
    return getNetworkInputLabels(rayCount);
  }, [bestCarBrain]);

  /**
   * Spawn AI cars into the current world using the loaded brain.
   */
  const spawnAICars = useCallback(() => {
    const currentWorld = worldRef.current;
    if (!currentWorld) return;

    currentWorld.spawnerSystem.clearCars();
    currentWorld.trainingSystem.reset();

    const baseBrain = brainRef.current ?? undefined;

    // Prefer path-based spawning, then source-based, then fallback
    const paths = currentWorld.pathFindingSystem.getPaths();
    if (paths.length > 0 && paths.some((p) => p.edges.length > 0)) {
      currentWorld.spawnerSystem.spawnCarsAtPaths(
        paths,
        ControlType.AI,
        baseBrain,
        0, // zero mutation — exact brain playback
      );
    } else {
      const source = currentWorld.markings.find((m) => m.type === "source");
      const path = currentWorld.pathFindingSystem.getPath();

      if (source && path.length > 0) {
        currentWorld.spawnerSystem.spawnCarsAtSource(
          1,
          ControlType.AI,
          source.position,
          path,
          baseBrain,
          0,
        );
      } else {
        currentWorld.spawnerSystem.spawnCarsAtPosition(
          1,
          ControlType.AI,
          new Node(0, 0),
          -Math.PI / 2,
          baseBrain,
          0,
        );
      }
    }

    currentWorld.draw();
    const spawned = currentWorld.spawnerSystem.getCarCount();
    setCarCount(spawned);
    setHasPlayerCar(spawned > 0);

    if (spawned > 0) {
      currentWorld.trainingSystem.startTraining();
      setIsRunning(true);
      toast(
        `Spawned ${spawned} AI car${spawned > 1 ? "s" : ""}.${baseBrain ? " Using shared brain." : " No brain found — random network."}`,
        "success",
      );
    } else {
      toast(
        "Could not spawn any cars. Ensure the world has roads.",
        "error",
      );
    }
  }, [worldRef, toast]);

  /**
   * Auto-load the world and brain when a worldUrl is provided.
   */
  useEffect(() => {
    if (!worldUrl || !world) return;

    let cancelled = false;

    (async () => {
      // Fetch brain first
      const brain = await fetchBrain("/brain.json");
      if (cancelled) return;
      brainRef.current = brain;
      if (!brain) {
        toast("No brain.json found — cars will use random networks.", "info");
      }

      // Load the world
      await loadWorldFromUrl(worldUrl, () => {
        if (cancelled) return;
        setWorldLoaded(true);
      });
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [worldUrl, world]);

  /**
   * Once the world is loaded, wait a short moment for generate() to rebuild
   * roads (triggered by the simulation loop's change detection), then spawn cars.
   */
  useEffect(() => {
    if (!worldLoaded) return;

    const timer = setTimeout(() => {
      spawnAICars();
      elapsedRef.current = 0;
      setElapsedTime(0);
    }, 500);

    return () => clearTimeout(timer);
  }, [worldLoaded, spawnAICars]);

  /**
   * Track best car and update stats while running.
   */
  useEffect(() => {
    if (!isRunning || !world) return;

    const intervalId = setInterval(() => {
      const training = world.trainingSystem;
      const cars = world.cars;
      if (cars.length === 0) return;

      const stats = training.getStats(cars);
      setCarsReachedDestination(stats.numOfCarsReachedDestination);

      const targetCarId = selectedCarId ?? stats.bestCarId;
      const currentTargetCar =
        targetCarId === null
          ? null
          : (cars.find((car) => car.id === targetCarId) ?? null);

      setBestCar(currentTargetCar);
      setBestCarBrain(currentTargetCar?.network ?? null);
      setCarCount(cars.length);

      // Update elapsed time
      elapsedRef.current += 0.1;
      setElapsedTime(elapsedRef.current);
    }, 100);

    return () => clearInterval(intervalId);
  }, [isRunning, world, selectedCarId]);

  /** Reset: re-spawn cars without reloading the world. */
  const handleReset = useCallback(() => {
    elapsedRef.current = 0;
    setElapsedTime(0);
    setCarsReachedDestination(0);
    setSelectedCarId(null);
    spawnAICars();
  }, [spawnAICars]);

  /** Spawn a single human-controlled car. */
  const handleSpawnPlayer = useCallback(() => {
    const currentWorld = worldRef.current;
    if (!currentWorld) {
      toast("World not ready yet.", "error");
      return;
    }

    const source = currentWorld.markings.find((m) => m.type === "source");
    const path = currentWorld.pathFindingSystem.getPath();

    if (source && path.length > 0) {
      currentWorld.spawnerSystem.spawnCarsAtSource(
        1,
        ControlType.HUMAN,
        source.position,
        path,
      );
    } else {
      currentWorld.spawnerSystem.spawnCarsAtPosition(
        1,
        ControlType.HUMAN,
        new Node(0, 0),
        -Math.PI / 2,
      );
    }

    currentWorld.draw();
    const spawned = currentWorld.spawnerSystem.getCarCount();
    setCarCount(spawned);
    setHasPlayerCar(true);
    toast("Player car spawned. Use WASD or arrow keys.", "success");
  }, [worldRef, toast]);

  /** Load a custom world via file picker. */
  const handleLoadWorld = useCallback(() => {
    loadFromJson(() => {
      setHasPlayerCar(false);
      setIsRunning(false);
      setCarCount(0);
      setCarsReachedDestination(0);
      setWorldLoaded(true);
      toast("World loaded. Spawn cars to begin.", "success");
    });
  }, [loadFromJson, toast]);

  /** Handle weight change from the neural network visualizer. */
  const handleWeightChange = useCallback(
    (layerIdx: number, fromIdx: number, toIdx: number, value: number) => {
      if (bestCar) {
        bestCar.updateWeight(layerIdx, fromIdx, toIdx, value);
      }
    },
    [bestCar],
  );

  /** Handle bias change from the neural network visualizer. */
  const handleBiasChange = useCallback(
    (layerIdx: number, neuronIdx: number, value: number) => {
      if (bestCar) {
        bestCar.updateBias(layerIdx, neuronIdx, value);
      }
    },
    [bestCar],
  );

  /** Format elapsed time as mm:ss. */
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <>
      <div
        className="absolute top-16 left-4 z-10 w-80"
        style={{ animation: "guide-enter 0.3s ease-out" }}
      >
        {/* Main panel */}
        <div className="overflow-hidden rounded-2xl border border-zinc-700/50 bg-zinc-900/95 shadow-2xl backdrop-blur-xl">
          {/* Header */}
          <div className="border-b border-zinc-700/40 px-5 py-3.5">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/15">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-indigo-400"
                >
                  <circle cx="12" cy="12" r="10" />
                  <polygon points="10 8 16 12 10 16 10 8" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-zinc-100">
                  {scenarioName ?? "Simulation Mode"}
                </h3>
                <p className="text-[11px] text-zinc-500">
                  {scenarioName
                    ? "AI-driven simulation"
                    : "Manual driving on loaded world"}
                </p>
              </div>
              {isRunning && (
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

          {/* Actions */}
          <div className="space-y-2 border-b border-zinc-700/30 px-5 py-4">
            <div className="flex gap-2">
              <Button
                className="flex-1 text-xs"
                size="sm"
                onClick={handleReset}
                disabled={!worldLoaded}
              >
                Reset
              </Button>
              <Button
                className="flex-1 text-xs"
                size="sm"
                variant="outline"
                onClick={handleSpawnPlayer}
                disabled={!worldLoaded}
              >
                {hasPlayerCar ? "Respawn" : "+ Player"}
              </Button>
            </div>
            {!worldUrl && (
              <Button
                className="w-full text-xs"
                size="sm"
                variant="outline"
                onClick={handleLoadWorld}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="shrink-0"
                >
                  <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
                Load World JSON
              </Button>
            )}
            {onBackToScenarios && (
              <Button
                className="w-full text-xs"
                size="sm"
                variant="outline"
                onClick={onBackToScenarios}
              >
                ← Back to Scenarios
              </Button>
            )}
          </div>

          {/* HUD Status */}
          <div className="border-b border-zinc-700/30 px-5 py-3">
            <p className="mb-2 text-[10px] font-semibold tracking-wider text-zinc-500 uppercase">
              Status
            </p>
            <div className="space-y-1.5">
              {[
                { label: "Cars", value: carCount },
                {
                  label: "Reached Dest.",
                  value: carsReachedDestination,
                },
                { label: "Elapsed", value: formatTime(elapsedTime) },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="flex items-center justify-between"
                >
                  <span className="text-xs text-zinc-400">{stat.label}</span>
                  <span className="font-mono text-xs font-medium text-zinc-300">
                    {stat.value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Controls guide */}
          <div className="px-5 py-3.5">
            <p className="mb-2.5 text-[10px] font-semibold tracking-wider text-zinc-500 uppercase">
              Driving Controls
            </p>
            <div className="flex flex-col gap-2.5">
              {/* WASD cluster */}
              <div className="flex items-center gap-3">
                <div className="flex flex-col items-center gap-0.5">
                  <KeyBadge>W</KeyBadge>
                  <div className="flex gap-0.5">
                    <KeyBadge>A</KeyBadge>
                    <KeyBadge>S</KeyBadge>
                    <KeyBadge>D</KeyBadge>
                  </div>
                </div>
                <span className="text-[11px] text-zinc-500">
                  or Arrow Keys
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-zinc-400">
                  Drag / right-click to orbit the camera
                </span>
              </div>
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
