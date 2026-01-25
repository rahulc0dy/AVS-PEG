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
    const minDistance = 10;

    const isTooClose = (position: Node): boolean =>
      this.cars.some((car) => distance(position, car.position) < minDistance);

    // If no roads exist, drop into a simple grid near origin
    if (this.roads.length === 0) {
      const cols = Math.ceil(Math.sqrt(count));
      const spacing = minDistance * 1.5;
      for (let i = 0; i < count; i++) {
        const row = Math.floor(i / cols);
        const col = i % cols;
        const x = (col - cols / 2) * spacing;
        const y = row * spacing;
        this.cars.push(
          new Car(
            new Node(x, y),
            this.breadth,
            this.length,
            this.height,
            controlType,
            this.worldGroup,
            0,
          ),
        );
      }
      return;
    }

    const maxAttempts = 50;
    for (let i = 0; i < count; i++) {
      let placed = false;

      for (let attempt = 0; attempt < maxAttempts && !placed; attempt++) {
        const road = this.roads[Math.floor(Math.random() * this.roads.length)];
        const skeleton = road.skeleton;
        const dir = skeleton.directionVector();
        const heading = angle(dir);

        // pick a random point along the road length (0..1 scaled by length)
        const offset = Math.random() * skeleton.length();
        const candidate = translate(skeleton.n1, heading, offset);

        if (isTooClose(candidate)) continue;

        this.cars.push(
          new Car(
            candidate,
            this.breadth,
            this.length,
            this.height,
            controlType,
            this.worldGroup,
            heading,
          ),
        );
        placed = true;
      }

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

    let dirAngle = 0;
    if (pathEdges && pathEdges.length > 0) {
      const e0 = pathEdges[0];
      const d1 = distance(srcNode, e0.n1);
      const d2 = distance(srcNode, e0.n2);
      const from = d1 <= d2 ? e0.n1 : e0.n2;
      const to = d1 <= d2 ? e0.n2 : e0.n1;
      dirAngle = angle(new Edge(from, to).directionVector());
    } else if (this.roads.length > 0) {
      let bestRoad = this.roads[0];
      let bestDist = Number.POSITIVE_INFINITY;
      for (const road of this.roads) {
        const { n1, n2 } = road.skeleton;
        const d = Math.min(distance(srcNode, n1), distance(srcNode, n2));
        if (d < bestDist) {
          bestDist = d;
          bestRoad = road;
        }
      }
      dirAngle = angle(bestRoad.skeleton.directionVector());
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
