import { Color, Group, Scene } from "three";
import { Edge } from "@/lib/primitives/edge";
import { Road } from "@/lib/world/road";
import { Polygon } from "@/lib/primitives/polygon";
import { Graph } from "@/lib/primitives/graph";
import { Car } from "@/lib/car/car";
import { ControlType } from "@/lib/car/controls";
import { TrafficLight } from "@/lib/markings/traffic-light";
import { Node } from "@/lib/primitives/node";
import { TrafficLightJson, WorldJson } from "@/types/save";
import { Marking } from "@/lib/markings/marking";
import { TrafficLightSystem } from "@/lib/systems/traffic-light-system";
import { Source } from "@/lib/markings/source";
import { Destination } from "@/lib/markings/destination";
import { PathFindingSystem } from "@/lib/systems/path-finding-system";
import { SpawnerSystem } from "@/lib/systems/spawner-system";
import { TrainingSystem } from "@/lib/systems/training-system";
import { MarkingWallJson } from "@/types/car/message";

/**
 * Configuration options for initializing a World instance.
 */
export interface WorldConfig {
  /**
   * Initial cars to spawn. If not provided, defaults to empty array.
   * Use `generateTraffic()` to spawn cars after initialization.
   */
  initialCars?: {
    position: Node;
    controlType: ControlType;
  }[];
}

/**
 * Responsible for generating visual road geometry from a `Graph`, managing
 * world objects (cars, markings), and providing serialization helpers for
 * save/load. The `World` owns a Three.js `Group` (`worldGroup`) which is
 * re-created each draw and attached to the provided `Scene`.
 */
export class World {
  /** Underlying road graph (nodes and edges). */
  graph: Graph;
  /** Three.js scene where the world will be rendered. */
  scene: Scene;
  /** Group used to collect world meshes before adding to the scene. */
  worldGroup: Group;
  /** Border segments produced by unioning road envelopes. */
  roadBorders: Edge[];
  /** Road objects (Envelopes) generated from graph edges. */
  roads: Road[];
  /** Simulated cars currently present in the world. */
  cars: Car[];
  /** Markings placed in the world (includes traffic lights). */
  markings: Marking[];

  /** Traffic light graph used by the traffic light editor/system. */
  trafficLightGraph: Graph;
  /** Traffic light system that advances signal phases over time. */
  trafficLightSystem!: TrafficLightSystem;

  pathFindingSystem!: PathFindingSystem;

  /** Training system for AI car training and progress tracking. */
  trainingSystem!: TrainingSystem;

  /** Spawner system for managing car spawning. */
  spawnerSystem!: SpawnerSystem;

  /**
   * Construct a World which generates visual road geometry from a `Graph`.
   *
   * @param scene - Three.js scene where generated geometry will be added
   * @param config - Optional configuration for world initialization
   */
  constructor(scene: Scene, config?: WorldConfig) {
    this.graph = new Graph();
    this.scene = scene;
    this.roadBorders = [];
    this.roads = [];
    this.worldGroup = new Group();

    // Initialize with empty car array by default
    // Cars can be added via config.initialCars or generateTraffic()
    this.cars = [];

    // If initial cars are provided in config, create them
    if (config?.initialCars) {
      for (const carConfig of config.initialCars) {
        this.cars.push(
          new Car(
            this.cars.length,
            carConfig.position,
            10, // breadth
            17.5, // length
            7, // height
            carConfig.controlType,
            this.worldGroup,
          ),
        );
      }
    }

    this.markings = [];

    this.trafficLightGraph = new Graph();
    this.trafficLightSystem = new TrafficLightSystem(
      this.trafficLightGraph,
      () =>
        this.markings.filter(
          (marking): marking is TrafficLight => marking instanceof TrafficLight,
        ),
    );

    this.pathFindingSystem = new PathFindingSystem(this.graph);

    this.trainingSystem = new TrainingSystem();

    this.spawnerSystem = new SpawnerSystem(
      this.cars,
      this.worldGroup,
      this.roads,
    );

    this.generate();
  }

  /**
   * Update the world state: move cars and update their sensors.
   * This function should be called once per frame.
   */
  update(deltaSeconds: number = 0) {
    this.trafficLightSystem.update(deltaSeconds);

    // Extract all active detection walls from markings
    const markingWalls = this.markings
      .map((m) => m.getMarkingWall())
      .filter((w): w is MarkingWallJson => w !== null);

    for (const car of this.cars) {
      car.update(
        this.cars.filter((c) => c !== car),
        this.pathFindingSystem.getPathBorders(),
        markingWalls, // Pass them into the car update
      );
    }

    // Update progress tracking for all cars
    if (this.cars.length > 0) {
      this.trainingSystem.update(this.cars);
    }

    for (const marking of this.markings) {
      marking.update();
    }
  }

  /**
   * Generate road visuals and unions for the current `graph`.
   *
   * This synchronizes the `roads` list with `graph.edges`. It preserves existing
   * Road objects (keeping their lane counts) if their underlying edges still exist,
   * creates new Roads for new edges, and removes Roads for deleted edges.
   */
  generate() {
    this.roadBorders = [];

    const graphEdges = this.graph.getEdges();

    // 1. Filter out roads whose skeletons no longer exist in the graph.
    // We match by endpoints because graph edges and road skeletons might be different instances.
    const survivingRoads: Road[] = [];
    for (const road of this.roads) {
      const match = graphEdges.find((e) => e.equals(road.skeleton));
      if (match) {
        // Update the skeleton to match the graph edge geometry perfectly (in case nodes moved)
        road.skeleton.n1 = match.n1;
        road.skeleton.n2 = match.n2;
        // Regenerate visuals since geometry might have changed
        road.regenerate();
        survivingRoads.push(road);
      } else {
        // Edge removed from graph, so remove the road
        road.dispose();
      }
    }
    this.roads = survivingRoads;

    // 2. Create new roads for any graph edges that don't have a matching road yet.
    for (const edge of graphEdges) {
      const exists = this.roads.some((r) => r.skeleton.equals(edge));
      if (!exists) {
        this.roads.push(
          new Road(
            edge,
            2, // default lane count
            "unclassified",
          ),
        );
      }
    }

    // 3. Compute the union of all road polygons to derive continuous borders
    this.roadBorders = Polygon.union(this.roads.map((r) => r.poly));

    // Update spawner system with new roads reference
    this.spawnerSystem.setRoads(this.roads);

    // Update path finding after regenerating roads
    this.updatePath();
  }

  /**
   * Update the path between source and destination markings.
   *
   * This is a lightweight operation compared to `generate()` and should be
   * called when only path finding needs to be updated (e.g., when source or
   * destination markings change), avoid calling this on every frame or
   * mouse event due to computational cost.
   */
  updatePath() {
    const source = this.markings.find((m) => m.type === "source");
    const destination = this.markings.find((m) => m.type === "destination");

    if (source && destination) {
      this.pathFindingSystem.findPath(source.position, destination.position);
    } else {
      // Clear the path if either marking is missing
      this.pathFindingSystem.reset();
    }

    // Sync path with training system
    this.trainingSystem.setPath(this.pathFindingSystem.getPath());
  }

  /**
   * Render the world: clear the `worldGroup`, draw roads and road borders,
   * and add the group to the scene.
   */
  draw() {
    this.worldGroup.clear();

    for (const road of this.roads) {
      road.draw(this.worldGroup, {
        fillColor: new Color(0x222021),
        showArrows: true,
      });
    }
    for (const edge of this.roadBorders) {
      edge.draw(this.worldGroup, { width: 8, color: new Color(0xffffff) });
    }

    this.pathFindingSystem.draw(this.worldGroup);

    this.scene.add(this.worldGroup);
  }

  /**
   * Dispose of any Three.js resources held by this world.
   */
  dispose() {
    for (const car of this.cars) {
      car.dispose();
    }
    for (const marking of this.markings) {
      marking.dispose();
    }
    for (const road of this.roads) {
      road.dispose();
    }
    this.pathFindingSystem.dispose();
    this.worldGroup.clear();
    if (this.worldGroup.parent) {
      this.worldGroup.parent.remove(this.worldGroup);
    }
  }

  /**
   * Serializes the world state to a plain JSON object.
   *
   * The returned object conforms to {@link WorldJson} and includes the
   * graph, traffic light graph, road borders, roads, and markings.
   * Can be passed to {@link World.fromJson} to reconstruct the world state.
   *
   * @returns A {@link WorldJson} object containing the complete serialized world state.
   */
  toJson(): WorldJson {
    return {
      graph: this.graph.toJson(),
      trafficLightGraph: this.trafficLightGraph.toJson(),
      roadBorders: this.roadBorders.map((rb) => rb.toJson()),
      roads: this.roads.map((r) => r.toJson()),
      markings: this.markings.map((m) => m.toJson()),
      paths: [],
    };
  }

  /**
   * Deserializes and loads world state from a plain JSON object.
   *
   * Disposes all existing scene resources before loading. Reconstructs
   * the graph, traffic light graph, road borders, roads, and markings
   * from the serialized data. Updates internal systems (spawner, path
   * finding) after loading.
   *
   * @param json - Serialized world data conforming to {@link WorldJson}.
   */
  fromJson(json: WorldJson): void {
    this.dispose();
    this.markings.length = 0;
    this.cars = []; // Clear the cars array after disposing

    this.graph.fromJson(json.graph);
    this.trafficLightGraph.fromJson(json.trafficLightGraph);

    this.roadBorders = json.roadBorders.map((rbj) => {
      return Edge.fromJson(rbj);
    });

    this.roads = json.roads.map((rj) => {
      return Road.fromJson(rj);
    });

    for (const mj of json.markings ?? []) {
      switch (mj.type) {
        case "traffic-light": {
          this.markings.push(
            TrafficLight.fromJson(mj as TrafficLightJson, this.worldGroup),
          );
          break;
        }
        case "source": {
          this.markings.push(Source.fromJson(mj, this.worldGroup) as Source);
          break;
        }
        case "destination": {
          this.markings.push(
            Destination.fromJson(mj, this.worldGroup) as Destination,
          );
          break;
        }
        default: {
          this.markings.push(Marking.fromJson(mj, this.worldGroup));
          break;
        }
      }
    }

    // Update spawner system with new references after loading
    this.spawnerSystem.setCars(this.cars);
    this.spawnerSystem.setRoads(this.roads);

    // Update path finding after loading markings
    this.updatePath();
  }
}
