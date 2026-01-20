import { Camera, Scene } from "three";
import { useCallback, useState } from "react";
import { useWorld } from "@/components/hooks/use-world";
import { useWorldSimulation } from "@/components/hooks/use-world-simulation";
import { useWorldPersistence } from "@/components/hooks/use-world-persistence";
import FpsMeter from "@/components/ui/fps-meter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Input from "@/components/ui/input";
import Label from "@/components/ui/label";
import Button from "@/components/ui/button";
import Checkbox from "@/components/ui/checkbox";

interface TrainingCanvasProps {
  scene: Scene;
  camera: Camera;
  dom: HTMLElement;
}

export default function TrainingCanvas({
  scene,
  camera,
  dom,
}: TrainingCanvasProps) {
  const [carCount, setCarCount] = useState<number>(10);
  const [isTraining, setIsTraining] = useState(false);
  const [spawnAtSource, setSpawnAtSource] = useState(true);
  const [currentCarCount, setCurrentCarCount] = useState(0);

  const { worldRef, world } = useWorld(scene, { showGrid: true });

  useWorldSimulation(worldRef, camera, dom);

  const { loadFromJson } = useWorldPersistence(worldRef);

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
  }, [worldRef]);

  // TODO: Implement spawner system
  const handleSpawnCars = useCallback(() => {
    // TODO: Spawning logic from spawner system
  }, [worldRef, carCount, spawnAtSource]);

  const handleClearCars = useCallback(() => {
    const world = worldRef.current;
    if (!world) return;

    // TODO: Clear all cars using SpawnerSystem
    // world.spawnerSystem.clearCars();
    setCurrentCarCount(0);
    setIsTraining(false);
  }, [worldRef]);

  const handleResetCars = useCallback(() => {
    // TODO: Reset Cars using the spawner system
  }, [worldRef, carCount, spawnAtSource]);

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
              checked={spawnAtSource}
              onChange={(e) => setSpawnAtSource(e.target.checked)}
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
