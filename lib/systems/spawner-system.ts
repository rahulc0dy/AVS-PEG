import { Group } from "three";
import { Car } from "@/lib/car/car";
import { Road } from "@/lib/world/road";
import { ControlType } from "@/lib/car/controls";
import { Edge } from "@/lib/primitives/edge";
import { Node } from "@/lib/primitives/node";
import { angle, distance, getNearestEdge, translate } from "@/utils/math";

/**
 * System responsible for spawning and managing cars in the world.
 *
 * This separates car spawning logic from the World class, making it easier
 * to manage training scenarios and different spawning strategies.
 */
export class SpawnerSystem {
  private readonly breadth = 10;
  private readonly length = 17.5;
  private readonly height = 7;

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
   */
  spawnCars(count: number, controlType: ControlType): void {
    // Minimum distance between car centers to avoid overlap
    const minDistance = 10;

    // Helper to check if a position is too close to existing cars
    const isTooClose = (position: Node): boolean => {
      for (const car of this.cars) {
        const dist = distance(position, car.position);
        if (dist < minDistance) {
          return true;
        }
      }
      return false;
    };

    // If no roads exist, spawn spread out from origin
    if (this.roads.length === 0) {
      const cols = Math.ceil(Math.sqrt(count));
      for (let i = 0; i < count; i++) {
        // Spread cars in a grid pattern to avoid overlap
        const row = Math.floor(i / cols);
        const col = i % cols;

        const spacing = minDistance * 1.5;
        const x = (col - cols / 2) * spacing;
        const y = row * spacing;

        const car = new Car(
          new Node(x, y),
          this.breadth,
          this.length,
          this.height,
          controlType,
          this.worldGroup,
          0,
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

        const newRandomPosition = translate(
          skeleton.n1,
          angle(skeleton.directionVector()),
          Math.random(),
        );

        // Check if position is valid (not too close to other cars)
        if (!isTooClose(newRandomPosition)) {
          const car = new Car(
            newRandomPosition,
            this.breadth,
            this.length,
            this.height,
            controlType,
            this.worldGroup,
            angle(skeleton.directionVector()),
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
    pathEdges?: Edge[],
  ): void {
    if (!sourcePosition) {
      this.spawnCars(count, controlType);
      return;
    }

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

    this.spawnCarsAtPosition(count, controlType, spawnPos, dirAngle);

    // Disable car-to-car detection via sensors AND prevent car-to-car overlap from marking cars as damaged
    // (so overlapped spawns can still move). World/road collisions are unaffected.
    for (let i = this.cars.length - 1; i >= 0 && count > 0; i--) {
      const car = this.cars[i];
      car.ignoreDamageFromCars();
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
  ): void {
    for (let i = 0; i < count; i++) {
      const car = new Car(
        // IMPORTANT: `Car.move()` mutates `this.position` every frame.
        // If we pass the same `Node` reference to multiple cars, they will all
        // mutate the same object, effectively multiplying movement speed by the
        // number of overlapped cars.
        new Node(position.x, position.y),
        this.breadth,
        this.length,
        this.height,
        controlType,
        this.worldGroup,
        angle,
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
