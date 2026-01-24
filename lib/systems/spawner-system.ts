import { Group } from "three";
import { Car, CarOptions } from "@/lib/car/car";
import { Road } from "@/lib/world/road";
import { ControlType } from "@/lib/car/controls";
import { Edge } from "@/lib/primitives/edge";
import { Node } from "@/lib/primitives/node";
import { distance, getNearestEdge } from "@/utils/math";

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
  /** Pre-trained brain to load for AI cars */
  brainJson?: object; // TODO: Change to appropriate type
  /** Mutation amount to apply to the brain (0 = no change, 1 = fully random) */
  mutationAmount?: number;
  /** Destination position for fitness calculation */
  destinationPosition?: Node;
  /** Path edges from source to destination */
  pathEdges?: object[]; // TODO: Change to appropriate type
  /** Total length of the path */
  totalPathLength?: number;
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
      brainJson,
      mutationAmount,
      destinationPosition,
      pathEdges,
      totalPathLength,
    } = options ?? {};

    // Build car options for AI training
    const carOptions: CarOptions | undefined =
      controlType === ControlType.AI
        ? {
            brainJson,
            mutationAmount,
            destinationPosition,
            pathEdges,
            totalPathLength,
          }
        : undefined;

    // Minimum distance between car centers to avoid overlap
    const minDistance = Math.max(breadth, length) * 1.5;

    // Helper to check if a position is too close to existing cars
    const isTooClose = (x: number, y: number): boolean => {
      for (const car of this.cars) {
        const dx = car.position.x - x;
        const dy = car.position.y - y;
        const dist = Math.hypot(dx, dy);
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
          new Node(x, y),
          breadth,
          length,
          height,
          controlType,
          this.worldGroup,
          0, // angle
          maxSpeed,
          carOptions,
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
            new Node(x, y),
            breadth,
            length,
            height,
            controlType,
            this.worldGroup,
            angle,
            maxSpeed,
            carOptions,
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
   * Spawn multiple cars stacked/overlapping at the world's Source marking.
   *
   * If no source marking exists, falls back to the default random-road spawning.
   */
  spawnCarsAtSource(
    count: number,
    controlType: ControlType,
    sourcePosition: Node | null | undefined,
    options?: SpawnOptions,
    pathEdges?: Edge[],
  ): void {
    if (!sourcePosition) {
      this.spawnCars(count, controlType, options);
      return;
    }

    const initialCount = count;

    const srcNode = sourcePosition;

    // Choose a direction in the CAR angle convention.
    // Car move uses:
    //   x -= sin(angle) * speed
    //   y -= cos(angle) * speed
    // so a world direction vector (dx, dy) corresponds to:
    //   angle = atan2(-dx, -dy)
    let dirAngle = 0;
    if (pathEdges && pathEdges.length > 0) {
      const e0 = pathEdges[0];
      const d1 = distance(srcNode, e0.n1);
      const d2 = distance(srcNode, e0.n2);
      const from = d1 <= d2 ? e0.n1 : e0.n2;
      const to = d1 <= d2 ? e0.n2 : e0.n1;

      const dx = to.x - from.x;
      const dy = to.y - from.y;
      dirAngle = Math.atan2(-dx, -dy);
    } else {
      if (this.roads.length > 0) {
        let bestRoad = this.roads[0];
        let bestDist = Number.POSITIVE_INFINITY;
        for (const road of this.roads) {
          const { n1, n2 } = road.skeleton;
          const d1 = distance(srcNode, n1);
          const d2 = distance(srcNode, n2);
          const d = Math.min(d1, d2);
          if (d < bestDist) {
            bestDist = d;
            bestRoad = road;
          }
        }
        const dx = bestRoad.skeleton.n2.x - bestRoad.skeleton.n1.x;
        const dy = bestRoad.skeleton.n2.y - bestRoad.skeleton.n1.y;
        dirAngle = Math.atan2(-dx, -dy);
      }
    }

    // Spawn position: project source onto the closest graph edge (better than using the raw marker).
    const nearEdge = getNearestEdge(
      srcNode,
      this.roads.map((r) => r.skeleton),
    );
    let spawnPos = srcNode;
    if (nearEdge) {
      spawnPos = nearEdge.projectNode(srcNode).point;
    }

    this.spawnCarsAtPosition(count, controlType, spawnPos, dirAngle, options);

    // Disable car-to-car detection via sensors AND prevent car-to-car overlap from marking cars as damaged
    // (so overlapped spawns can still move). World/road collisions are unaffected.
    for (let i = this.cars.length - 1; i >= 0 && count > 0; i--) {
      const car = this.cars[i];
      car.ignoreCarDamage = true;
      if (car.sensor) car.sensor.ignoreTraffic = true;
      count--;
    }
  }

  /**
   * Spawn multiple cars at the exact same position.
   *
   * This intentionally allows overlaps (used for certain training scenarios).
   */
  spawnCarsAtPosition(
    count: number,
    controlType: ControlType,
    position: Node,
    angle: number = 0,
    options?: SpawnOptions,
  ): void {
    const {
      breadth = 10,
      length = 17.5,
      height = 7,
      maxSpeed = 0.5,
      brainJson,
      mutationAmount,
      destinationPosition,
      pathEdges,
      totalPathLength,
    } = options ?? {};

    // Build car options for AI training
    const carOptions: CarOptions | undefined =
      controlType === ControlType.AI
        ? {
            brainJson,
            mutationAmount,
            destinationPosition,
            pathEdges,
            totalPathLength,
          }
        : undefined;

    for (let i = 0; i < count; i++) {
      const car = new Car(
        new Node(position.x, position.y),
        breadth,
        length,
        height,
        controlType,
        this.worldGroup,
        angle,
        maxSpeed,
        carOptions,
      );
      this.cars.push(car);
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
   * Get the current number of cars.
   */
  getCarCount(): number {
    return this.cars.length;
  }
}
