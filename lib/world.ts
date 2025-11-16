import { Color, Group, Scene } from "three";
import { Edge } from "./primitives/edge";
import { Envelope } from "./primitives/envelope";
import { Polygon } from "./primitives/polygon";
import { Graph } from "./primitives/graph";

export class World {
  graph: Graph;
  scene: Scene;
  worldGroup: Group;
  roadWidth: number;
  roadRoundness: number;
  roadBorders: Edge[];
  envelopes: Envelope[];
  laneGuides: Edge[];

  constructor(
    graph: Graph,
    scene: Scene,
    roadWidth: number = 30,
    roadRoundness: number = 8
  ) {
    this.graph = graph;
    this.scene = scene;
    this.roadWidth = roadWidth;
    this.roadRoundness = roadRoundness;
    this.roadBorders = [];
    this.envelopes = [];
    this.laneGuides = [];
    this.worldGroup = new Group();

    this.generate();
  }

  generate() {
    this.envelopes.length = 0;
    for (const edge of this.graph.getEdges()) {
      this.envelopes.push(
        new Envelope(edge, this.roadWidth, this.roadRoundness)
      );
    }

    this.roadBorders = Polygon.union(this.envelopes.map((e) => e.poly));

    this.laneGuides.length = 0;
    this.laneGuides.push(...this.generateLaneGuides());
  }

  generateLaneGuides() {
    const tmpEnvelopes: Envelope[] = [];
    for (const edge of this.graph.getEdges()) {
      tmpEnvelopes.push(
        new Envelope(edge, this.roadWidth / 2, this.roadRoundness)
      );
    }
    const segments = Polygon.union(tmpEnvelopes.map((e) => e.poly));
    return segments;
  }

  draw() {
    this.worldGroup.clear();

    for (const envelope of this.envelopes) {
      envelope.draw(this.worldGroup, {
        fillColor: new Color(0x222021),
      });
    }
    for (const edge of this.roadBorders) {
      edge.draw(this.worldGroup, { width: 8, color: new Color(0xffffff) });
    }

    this.scene.add(this.worldGroup);
  }
}
