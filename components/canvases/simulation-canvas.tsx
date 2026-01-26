"use client";

import { useCallback, useMemo, useState } from "react";
import { Camera, Scene } from "three";
import Button from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
 * Simulation canvas for manual driving on a loaded world.
 *
 * Responsibilities:
 * - Initialize the world (no editors) and run the simulation loop.
 * - Allow loading a saved world JSON.
 * - Spawn a single human-controlled car (WASD/arrow keys).
 * - Provide lightweight status (player presence, speed).
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
      <Card className="absolute top-6 left-6 z-10 w-80 border-zinc-700 bg-zinc-900/90 text-zinc-50 backdrop-blur">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold text-zinc-50">
            Simulation Mode
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Button
              className="flex-1"
              onClick={handleLoadWorld}
              variant="outline"
            >
              Load World JSON
            </Button>
          </div>

          <div className="flex gap-2">
            <Button className="flex-1" onClick={handleSpawnPlayer}>
              {hasPlayerCar ? "Respawn Player" : "Spawn Player"}
            </Button>
            <Button
              className="flex-1"
              variant="outline"
              onClick={handleClearCars}
            >
              Clear Cars
            </Button>
          </div>

          <div className="text-sm text-zinc-400 space-y-1">
            <p>Player car: {hasPlayerCar ? "Active" : "Not spawned"}</p>
            <p>Speed: {playerSpeed.toFixed(2)} u/s</p>
            <p className="text-xs text-zinc-500">
              Drive with WASD or Arrow Keys. Drag/right-click to orbit the
              scene.
            </p>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
