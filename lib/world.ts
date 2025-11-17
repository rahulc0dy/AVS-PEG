import {
  BoxGeometry,
  Color,
  Group,
  Mesh,
  MeshBasicMaterial,
  Scene,
  Vector2,
} from "three";
import { Edge } from "./primitives/edge";
import { Envelope } from "./primitives/envelope";
import { Polygon } from "./primitives/polygon";
import { Graph } from "./primitives/graph";
import { angle, distance } from "@/utils/math";
import { Node } from "./primitives/node";
import { Car } from "./objects/car";
import { ControlType } from "./objects/controls";

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
  traffic: Car[];

  /** Cached Three.js mesh used for filled rendering; created lazily. */
  private roadBorderMesh: Mesh<BoxGeometry, MeshBasicMaterial> | null = null;

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
        new Vector2(100, 100),
        30,
        50,
        ControlType.HUMAN,
        this.worldGroup
      ),
    ];
    this.traffic = [];

    // Build derived geometry immediately
    this.generate();
  }

  /**
   * Update the world state: move cars and update their sensors.
   * This function should be called once per frame.
   */
  update() {
    for (const car of this.cars) {
      car.update(this.roadBorders, this.traffic);
    }
    for (const car of this.traffic) {
      car.update(this.roadBorders, this.cars);
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

      const roadBorderHeight = 10;
      const roadBorderGeometry = new BoxGeometry(
        distance(edge.n1, edge.n2),
        roadBorderHeight,
        1
      );
      const roadBorderMaterial = new MeshBasicMaterial({
        color: new Color(0xff0000),
        transparent: true,
        opacity: 0.5,
      });
      this.roadBorderMesh = new Mesh(roadBorderGeometry, roadBorderMaterial);

      this.roadBorderMesh.position.set(
        (edge.n1.x + edge.n2.x) / 2,
        roadBorderHeight / 2,
        (edge.n1.y + edge.n2.y) / 2
      );
      this.roadBorderMesh.rotation.y = -angle(
        new Node(edge.n2.x - edge.n1.x, edge.n2.y - edge.n1.y)
      );

      this.worldGroup.add(this.roadBorderMesh);
    }

    this.scene.add(this.worldGroup);
  }

  /**
   * Dispose of any Three.js resources held by this world (geometry + material)
   * and clear the cached mesh reference.
   */
  dispose() {
    if (this.roadBorderMesh) {
      this.roadBorderMesh.geometry.dispose();
      this.roadBorderMesh.material.dispose();
      this.roadBorderMesh = null;
    }
  }
}
