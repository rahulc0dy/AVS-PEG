import { Color, Group, Scene, Vector2 } from "three";
import { Edge } from "@/lib/primitives/edge";
import { Envelope } from "@/lib/primitives/envelope";
import { Polygon } from "@/lib/primitives/polygon";
import { Graph } from "@/lib/primitives/graph";
import { Car } from "@/lib/car/car";
import { ControlType } from "@/lib/car/controls";
import { TrafficLight } from "@/lib/markings/traffic-light";
import { Node } from "@/lib/primitives/node";
import { TrafficLightJson, WorldJson } from "@/types/save";
import { Marking } from "@/lib/markings/marking";
import { TrafficLightSystem } from "@/lib/systems/traffic-light-system";

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
  /** Road polygons generated from graph edges. */
  roads: Envelope[];

  cars: Car[];
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

    // Traffic light graph + system are owned by the World.
    this.trafficLightGraph = new Graph();
    this.trafficLightSystem = new TrafficLightSystem(
      this.trafficLightGraph,
      () =>
        this.markings.filter(
          (marking): marking is TrafficLight => marking instanceof TrafficLight,
        ),
    );

    // Build derived geometry immediately
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
   * Generate envelope polygons and unions for the current `graph`.
   *
   * This rebuilds `envelopes`, computes the unioned `roadBorders`, and
   * regenerates `laneGuides`. The operation is idempotent with respect to
   * the current graph state and intended to be called after graph updates.
   */
  generate() {
    // Recompute envelopes for every edge in the graph
    this.roads.length = 0;
    for (const edge of this.graph.getEdges()) {
      this.roads.push(new Envelope(edge, this.roadWidth, this.roadRoundness));
    }

    // Compute the union of all envelope polygons to derive continuous borders
    this.roadBorders = Polygon.union(this.roads.map((e) => e.poly));
  }

  /**
   * Render the world: clear the `worldGroup`, draw envelopes and road borders,
   * and add the group to the scene. Colors and widths are currently hardcoded
   * here for a base visual appearance.
   */
  draw() {
    this.worldGroup.clear();

    for (const envelope of this.roads) {
      envelope.draw(this.worldGroup, {
        fillColor: new Color(0x222021),
      });
    }
    for (const edge of this.roadBorders) {
      edge.draw(this.worldGroup, { width: 8, color: new Color(0xffffff) });
    }

    this.scene.add(this.worldGroup);
  }

  /**
   * Dispose of any Three.js resources held by this world (geometry + material)
   * and clear the cached mesh reference.
   */
  dispose() {
    for (const car of this.cars) {
      car.dispose();
    }
    for (const marking of this.markings) {
      marking.dispose();
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
  toJson() {
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
   * disposed before loading to avoid leaking GPU resources.
   * @param json - Deserialized `WorldJson` object to load
   */
  fromJson(json: WorldJson) {
    for (const marking of this.markings) {
      marking.dispose();
    }
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
      const envelope = new Envelope(
        new Edge(new Node(0, 0), new Node(0, 0)),
        this.roadWidth,
        this.roadRoundness,
      );
      envelope.fromJson(rj);
      return envelope;
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
  }
}
