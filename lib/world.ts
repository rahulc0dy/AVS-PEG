import { Color, Group, Scene, Vector2 } from "three";
import { Edge } from "@/lib/primitives/edge";
import { Road } from "@/lib/primitives/road";
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
  /** Width used when constructing road envelopes (in same units as Nodes). */
  roadWidth: number;
  /** Controls smoothness of envelope end caps (higher = smoother). */
  roadRoundness: number;
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

  /**
   * Construct a World which generates visual road geometry from a `Graph`.
   *
   * @param scene - Three.js scene where generated geometry will be added
   * @param roadWidth - Width used for road envelopes (default: 30)
   * @param roadRoundness - Sampling used to approximate rounded ends (default: 8)
   */
  constructor(scene: Scene, roadWidth: number = 40, roadRoundness: number = 8) {
    this.graph = new Graph();
    this.scene = scene;
    this.roadWidth = roadWidth;
    this.roadRoundness = roadRoundness;
    this.roadBorders = [];
    this.roads = [];
    this.worldGroup = new Group();

    this.cars = [
      new Car(
        new Vector2(0, 0),
        10,
        17.5,
        7,
        ControlType.HUMAN,
        this.worldGroup,
      ),
      new Car(
        new Vector2(20, 0),
        10,
        17.5,
        7,
        ControlType.NONE,
        this.worldGroup,
      ),
    ];

    this.markings = [];

    this.trafficLightGraph = new Graph();
    this.trafficLightSystem = new TrafficLightSystem(
      this.trafficLightGraph,
      () =>
        this.markings.filter(
          (marking): marking is TrafficLight => marking instanceof TrafficLight,
        ),
    );

    this.generate();
  }

  /**
   * Update the world state: move cars and update their sensors.
   * This function should be called once per frame.
   */
  update(deltaSeconds: number = 0) {
    this.trafficLightSystem.update(deltaSeconds);

    for (const car of this.cars) {
      car.update(this.cars.filter((c) => c !== car));
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
            edge.n1,
            edge.n2,
            2, // default lane count
            edge.isDirected,
            "unclassified",
            this.roadWidth,
            this.roadRoundness,
          ),
        );
      }
    }

    // 3. Compute the union of all road polygons to derive continuous borders
    this.roadBorders = Polygon.union(this.roads.map((r) => r.poly));
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
      });
    }
    for (const edge of this.roadBorders) {
      edge.draw(this.worldGroup, { width: 8, color: new Color(0xffffff) });
    }

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
    this.worldGroup.clear();
    if (this.worldGroup.parent) {
      this.worldGroup.parent.remove(this.worldGroup);
    }
  }

  /**
   * Serialize the world state to a plain JSON object suitable for saving.
   * @returns world JSON containing graph, roads, borders and markings
   */
  toJson(): WorldJson {
    return {
      graph: this.graph.toJson(),
      trafficLightGraph: this.trafficLightGraph.toJson(),
      roadWidth: this.roadWidth,
      roadRoundness: this.roadRoundness,
      roadBorders: this.roadBorders.map((rb) => rb.toJson()),
      roads: this.roads.map((r) => r.toJson()),
      markings: this.markings.map((m) => m.toJson()),
    };
  }

  /**
   * Populate the world from serialized JSON. Existing scene resources are
   * disposed before loading.
   * @param json - Deserialized `WorldJson` object to load
   */
  fromJson(json: WorldJson): void {
    this.dispose();
    this.markings.length = 0;

    this.graph.fromJson(json.graph);
    this.trafficLightGraph.fromJson(json.trafficLightGraph);

    this.roadWidth = json.roadWidth;
    this.roadRoundness = json.roadRoundness;

    this.roadBorders = json.roadBorders.map((rbj) => {
      const edge = new Edge(new Node(0, 0), new Node(0, 0));
      edge.fromJson(rbj);
      return edge;
    });

    this.roads = json.roads.map((rj) => {
      const road = new Road(
        new Node(0, 0),
        new Node(0, 0),
        2,
        false,
        "unclassified",
        this.roadWidth,
        this.roadRoundness,
      );
      road.fromJson(rj);
      return road;
    });

    for (const mj of json.markings ?? []) {
      switch (mj.type) {
        case "traffic-light": {
          const tl = new TrafficLight(
            new Node(0, 0),
            new Node(0, 0),
            this.worldGroup,
          );
          tl.fromJson(mj as TrafficLightJson);
          this.markings.push(tl);
          break;
        }
        case "source": {
          const src = new Source(
            new Node(0, 0),
            new Node(0, 0),
            this.worldGroup,
          );
          src.fromJson(mj);
          this.markings.push(src);
          break;
        }
        case "destination": {
          const dest = new Destination(
            new Node(0, 0),
            new Node(0, 0),
            this.worldGroup,
          );
          dest.fromJson(mj);
          this.markings.push(dest);
          break;
        }
        default: {
          const m = new Marking(
            new Node(0, 0),
            new Node(0, 0),
            this.worldGroup,
            mj.type,
          );
          m.fromJson(mj);
          this.markings.push(m);
          break;
        }
      }
    }

    this.generate();
  }
}
