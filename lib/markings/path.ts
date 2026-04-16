import { Node } from "@/lib/primitives/node";
import { Edge } from "@/lib/primitives/edge";
import { PathJson, NodeJson, EdgeJson } from "@/types/save";

export class Path {
  waypoints: Node[];
  isLoop: boolean;
  edges: Edge[] = [];
  borders: Edge[] = [];
  color: string;
  constructor(
    waypoints: Node[],
    isLoop: boolean,
    edges: Edge[] = [],
    borders: Edge[] = [],
    color?: string,
  ) {
    this.waypoints = waypoints;
    this.isLoop = isLoop;
    this.edges = edges;
    this.borders = borders;
    // Generate a random color hex string if not provided
    this.color =
      color ||
      "#" +
        Math.floor(Math.random() * 16777215)
          .toString(16)
          .padStart(6, "0");
  }

  static fromJson(json: PathJson): Path {
    return new Path(
      json.waypoints.map((n: NodeJson) => Node.fromJson(n)),
      json.isLoop,
      json.edges.map((e: EdgeJson) => Edge.fromJson(e)),
      json.borders.map((e: EdgeJson) => Edge.fromJson(e)),
      json.color,
    );
  }

  toJson(): PathJson {
    return {
      waypoints: this.waypoints.map((n) => n.toJson()),
      isLoop: this.isLoop,
      edges: this.edges.map((e) => e.toJson()),
      borders: this.borders.map((e) => e.toJson()),
      color: this.color,
    };
  }
}
