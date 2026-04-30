"use client";

import { useCallback, useMemo, useState } from "react";
import { Camera, Scene } from "three";
import Button from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useWorld } from "@/components/hooks/use-world";
import { useWorldSimulation } from "@/components/hooks/use-world-simulation";
import { useWorldPersistence } from "@/components/hooks/use-world-persistence";
import { ControlType } from "@/lib/car/controls";
import { Node } from "@/lib/primitives/node";

interface SimulationCanvasProps {
  scene: Scene;
  camera: Camera;
  dom: HTMLElement;
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
 * Simulation canvas for manual driving on a loaded world.
 *
 * Responsibilities:
 * - Initialize the world (no editors) and run the simulation loop.
 * - Allow loading a saved world JSON.
 * - Spawn a single human-controlled car (WASD/arrow keys).
 * - Provide lightweight status (player presence, speed).
 * - Display contextual driving controls guide.
 */
export default function SimulationCanvas({
  scene,
  camera,
  dom,
}: SimulationCanvasProps) {
  const [hasPlayerCar, setHasPlayerCar] = useState(false);

  // Create world and start simulation loop
  const { worldRef, world } = useWorld(scene, { showGrid: true });
  useWorldSimulation(worldRef, camera, dom);

  const { toast } = useToast();
  const { loadFromJson } = useWorldPersistence(worldRef);

  /** Spawn a single human-controlled car, preferring the Source marker when present. */
  const handleSpawnPlayer = useCallback(() => {
    const currentWorld = worldRef.current;
    if (!currentWorld) {
      toast("World not ready yet.", "error");
      return;
    }

    // Keep a single player car to avoid competing keyboard listeners
    currentWorld.spawnerSystem.clearCars();

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
    setHasPlayerCar(spawned > 0);

    if (spawned > 0) {
      toast("Player car spawned. Use WASD or arrow keys to drive.", "success");
    } else {
      toast("Could not spawn a player car. Add roads or a source.", "error");
    }
  }, [worldRef, toast]);

  /** Clear all cars (useful when reloading a map). */
  const handleClearCars = useCallback(() => {
    const currentWorld = worldRef.current;
    if (!currentWorld) return;

    currentWorld.spawnerSystem.clearCars();
    setHasPlayerCar(false);
    toast("All cars cleared.", "info");
  }, [worldRef, toast]);

  /** Load a world JSON and reset player state. */
  const handleLoadWorld = useCallback(() => {
    loadFromJson(() => {
      setHasPlayerCar(false);
      toast("World loaded. Spawn a player to drive.", "success");
    });
  }, [loadFromJson, toast]);

  /** Display the current player speed (abs) from the first car. */
  const playerSpeed = useMemo(() => {
    const car = world?.cars[0];
    return car ? Math.abs(car.speed) : 0;
  }, [world?.cars]);

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
              <div>
                <h3 className="text-sm font-semibold text-zinc-100">
                  Simulation Mode
                </h3>
                <p className="text-[11px] text-zinc-500">
                  Manual driving on loaded world
                </p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-2 border-b border-zinc-700/30 px-5 py-4">
            <Button
              className="w-full"
              onClick={handleLoadWorld}
              variant="outline"
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

            <div className="flex gap-2">
              <Button className="flex-1" onClick={handleSpawnPlayer}>
                {hasPlayerCar ? "Respawn" : "Spawn Player"}
              </Button>
              <Button
                className="flex-1"
                variant="outline"
                onClick={handleClearCars}
              >
                Clear Cars
              </Button>
            </div>
          </div>

          {/* Status */}
          <div className="border-b border-zinc-700/30 px-5 py-3">
            <p className="mb-2 text-[10px] font-semibold tracking-wider text-zinc-500 uppercase">
              Status
            </p>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-400">Player Car</span>
                <span
                  className={`flex items-center gap-1.5 text-xs font-medium ${hasPlayerCar ? "text-emerald-400" : "text-zinc-600"}`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${hasPlayerCar ? "bg-emerald-400" : "bg-zinc-600"}`}
                    style={
                      hasPlayerCar
                        ? { animation: "status-pulse 2s ease-in-out infinite" }
                        : undefined
                    }
                  />
                  {hasPlayerCar ? "Active" : "Not spawned"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-400">Speed</span>
                <span className="font-mono text-xs font-medium text-zinc-300">
                  {playerSpeed.toFixed(2)}{" "}
                  <span className="text-zinc-600">u/s</span>
                </span>
              </div>
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
    </>
  );
}
