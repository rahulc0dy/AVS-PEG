import { Car } from "@/lib/car/car";
import { ControlType } from "@/lib/car/controls";
import { Road } from "@/lib/world/road";
import { Group, Vector2 } from "three";

/**
 * Configuration options for spawning cars.
 */
export interface SpawnOptions {
  /** Custom breadth for cars (default: 10) */
  breadth?: number;
  /** Custom length for cars (default: 17.5) */
  length?: number;
  /** Custom height for cars (default: 7) */
  height?: number;
  /** Custom max speed for cars (default: 0.5) */
  maxSpeed?: number;
}

/**
 * System responsible for spawning and managing cars in the world.
 *
 * This separates car spawning logic from the World class, making it easier
 * to manage training scenarios and different spawning strategies.
 */
export class SpawnerSystem {
  private cars: Car[];
  private worldGroup: Group;
  private roads: Road[];

  /**
   * Create a new SpawnerSystem.
   *
   * @param cars - Reference to the world's cars array
   * @param worldGroup - Three.js group where car meshes are added
   * @param roads - Reference to the world's roads array
   */
  constructor(cars: Car[], worldGroup: Group, roads: Road[]) {
    this.cars = cars;
    this.worldGroup = worldGroup;
    this.roads = roads;
  }

  /**
   * Update the roads reference (call after world regeneration).
   */
  setRoads(roads: Road[]) {
    this.roads = roads;
  }

  /**
   * Update the cars reference (call after world reload).
   */
  setCars(cars: Car[]) {
    this.cars = cars;
  }

  /**
   * Spawn multiple cars at random positions on roads.
   *
   * @param count - Number of cars to spawn
   * @param controlType - Control type for all spawned cars (e.g., AI, HUMAN, NONE)
   * @param options - Optional configuration for car spawning
   */
  spawnCars(
    count: number,
    controlType: ControlType,
    options?: SpawnOptions,
  ): void {
    const {
      breadth = 10,
      length = 17.5,
      height = 7,
      maxSpeed = 0.5,
    } = options ?? {};

    // Minimum distance between car centers to avoid overlap
    const minDistance = Math.max(breadth, length) * 1.5;

    // Helper to check if a position is too close to existing cars
    const isTooClose = (x: number, y: number): boolean => {
      for (const car of this.cars) {
        const dx = car.position.x - x;
        const dy = car.position.y - y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < minDistance) {
          return true;
        }
      }
      return false;
    };

    // If no roads exist, spawn spread out from origin
    if (this.roads.length === 0) {
      for (let i = 0; i < count; i++) {
        // Spread cars in a grid pattern to avoid overlap
        const cols = Math.ceil(Math.sqrt(count));
        const row = Math.floor(i / cols);
        const col = i % cols;
        const spacing = minDistance * 1.5;
        const x = (col - cols / 2) * spacing;
        const y = row * spacing;

        const car = new Car(
          new Vector2(x, y),
          breadth,
          length,
          height,
          controlType,
          this.worldGroup,
          0, // angle
          maxSpeed,
        );
        this.cars.push(car);
      }
      return;
    }

    // Spawn cars at random positions along roads, avoiding overlaps
    const maxAttempts = 50; // Max attempts per car to find a valid position
    for (let i = 0; i < count; i++) {
      let placed = false;

      for (let attempt = 0; attempt < maxAttempts && !placed; attempt++) {
        // Pick a random road
        const road = this.roads[Math.floor(Math.random() * this.roads.length)];
        const skeleton = road.skeleton;

        // Get random position along the road
        const t = Math.random();
        const x = skeleton.n1.x + t * (skeleton.n2.x - skeleton.n1.x);
        const y = skeleton.n1.y + t * (skeleton.n2.y - skeleton.n1.y);

        // Check if position is valid (not too close to other cars)
        if (!isTooClose(x, y)) {
          // Calculate road angle for car orientation
          const angle = Math.atan2(
            skeleton.n2.y - skeleton.n1.y,
            skeleton.n2.x - skeleton.n1.x,
          );

          const car = new Car(
            new Vector2(x, y),
            breadth,
            length,
            height,
            controlType,
            this.worldGroup,
            angle,
            maxSpeed,
          );
          this.cars.push(car);
          placed = true;
        }
      }

      // If couldn't place after max attempts, skip this car
      if (!placed) {
        console.warn(
          `Could not find valid position for car ${i + 1}/${count} after ${maxAttempts} attempts`,
        );
      }
    }
  }

  /**
   * Clear all cars from the world.
   */
  clearCars(): void {
    for (const car of this.cars) {
      car.dispose();
    }
    this.cars.length = 0;
  }

  /**
   * Reset cars by clearing existing and spawning new ones.
   *
   * @param count - Number of cars to spawn
   * @param controlType - Control type for all spawned cars
   * @param options - Optional configuration for car spawning
   */
  resetCars(
    count: number,
    controlType: ControlType,
    options?: SpawnOptions,
  ): void {
    this.clearCars();
    this.spawnCars(count, controlType, options);
  }

  /**
   * Get the current number of cars.
   */
  getCarCount(): number {
    return this.cars.length;
  }
}
