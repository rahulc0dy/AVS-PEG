import { Group } from "three";
import { Car } from "@/lib/car/car";
import { Road } from "@/lib/world/road";
import { ControlType } from "@/lib/car/controls";
import { Edge } from "@/lib/primitives/edge";
import { Node } from "@/lib/primitives/node";
import { angle, average } from "@/utils/math";

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

  private readonly worldGroup: Group;

  private cars: Car[];
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
   * Spawn multiple cars at random roads.
   *
   * @param count - Number of cars to spawn
   * @param controlType - Control type for all spawned cars (e.g., AI, HUMAN, NONE)
   */
  spawnCars(count: number, controlType: ControlType): void {
    if (count <= 0 || this.roads.length === 0) return;

    // Cap count to roads length
    const carsToSpawn = Math.min(count, this.roads.length);

    // Select random roads without repetition
    const shuffledRoads = [...this.roads].sort(() => Math.random() - 0.5);
    const selectedRoads = shuffledRoads.slice(0, carsToSpawn);

    for (const road of selectedRoads) {
      const skeleton = road.skeleton;

      // Calculate midpoint from skeleton edge endpoints
      const midpoint = average(skeleton.n1, skeleton.n2);
      const roadAngle = angle(skeleton.directionVector());

      const car = new Car(
        this.cars.length,
        midpoint,
        this.breadth,
        this.length,
        this.height,
        controlType,
        this.worldGroup,
        roadAngle,
      );
      this.cars.push(car);
    }
  }

  /**
   * Spawn multiple cars stacked/overlapping at the world's Source marking.
   */
  spawnCarsAtSource(
    count: number,
    controlType: ControlType,
    sourceNode: Node,
    pathEdges: Edge[],
  ): void {
    if (pathEdges.length === 0) {
      console.warn("No path found for source marking, skipping spawn.");
      return;
    }
    const firstPathEdge = pathEdges[0];

    this.spawnCarsAtPosition(
      count,
      controlType,
      firstPathEdge.projectNode(sourceNode).point,
      angle(firstPathEdge.directionVector()),
    );

    this.spawnCarsAtPosition(
      1,
      ControlType.HUMAN,
      firstPathEdge.projectNode(sourceNode).point,
      angle(firstPathEdge.directionVector()),
    );
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
        this.cars.length,
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
        // Disable car-to-car detection via sensors AND prevent car-to-car overlap from marking cars as damaged
        // (so overlapped spawns can still move). World/road collisions are unaffected.
        true,
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
