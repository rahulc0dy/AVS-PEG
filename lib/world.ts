import { Color, Group, Scene, Vector2 } from "three";
import { Edge } from "./primitives/edge";
import { Envelope } from "./primitives/envelope";
import { Polygon } from "./primitives/polygon";
import { Graph } from "./primitives/graph";
import { Car } from "./car/car";
import { ControlType } from "./car/controls";
import { TrafficLight } from "./markings/traffic-light";
import { Node } from "./primitives/node";
import { WorldJson, NodeJson, EdgeJson, TrafficLightJson } from "@/types/save";

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
  trafficLights: TrafficLight[];

  /**
   * Construct a World which generates visual road geometry from a `Graph`.
   *
   * @param graph - Road graph providing edges to thicken into roads
   * @param scene - Three.js scene where generated geometry will be added
   * @param roadWidth - Width used for road envelopes (default: 30)
   * @param roadRoundness - Sampling used to approximate rounded ends (default: 8)
   */
  constructor(
    graph: Graph,
    scene: Scene,
    roadWidth: number = 40,
    roadRoundness: number = 8
  ) {
    this.graph = graph;
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
        this.worldGroup
      ),
      new Car(
        new Vector2(20, 0),
        10,
        17.5,
        7,
        ControlType.NONE,
        this.worldGroup
      ),
    ];

    this.trafficLights = [new TrafficLight(new Node(50, 50), this.worldGroup)];

    // Build derived geometry immediately
    this.generate();
  }

  /**
   * Update the world state: move cars and update their sensors.
   * This function should be called once per frame.
   */
  update() {
    for (const car of this.cars) {
      car.update(this.cars.filter((c) => c !== car));
    }
    for (const light of this.trafficLights) {
      light.update();
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
    this.worldGroup.clear();
    if (this.worldGroup.parent) {
      this.worldGroup.parent.remove(this.worldGroup);
    }
  }

  toJson() {
    return {
      graph: this.graph.toJson(),
      roadWidth: this.roadWidth,
      roadRoundness: this.roadRoundness,
      roadBorders: this.roadBorders.map((rb) => rb.toJson()),
      roads: this.roads.map((r) => r.toJson()),
      trafficLights: this.trafficLights.map((tl) => tl.toJson()),
    };
  }

  fromJson(json: WorldJson) {
    this.dispose();

    this.graph.fromJson(json.graph);
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
        this.roadRoundness
      );
      envelope.fromJson(rj);
      return envelope;
    });
    this.trafficLights = json.trafficLights.map((tlj) => {
      const tl = new TrafficLight(new Node(0, 0), this.worldGroup);
      tl.fromJson(tlj);
      return tl;
    });
  }
}
