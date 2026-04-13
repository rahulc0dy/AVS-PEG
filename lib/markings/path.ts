import { exp } from "@tensorflow/tfjs";
import { Destination } from "./destination";
import { Source } from "./source";

import { Node } from "@/lib/primitives/node";
import { Edge } from "../primitives/edge";

export class Path {
  nodes: Node[];
  isLoop: boolean;
  edges: Edge[] = [];
  pathBorders: Edge[] = [];
  constructor(
    nodes: Node[],
    isLoop: boolean,
    edges: Edge[] = [],
    pathBorders: Edge[] = [],
  ) {
    this.nodes = nodes;
    this.isLoop = isLoop;
    this.edges = edges;
    this.pathBorders = pathBorders;
  }
  toJson() {
    return {
      nodes: this.nodes.map((n) => n.toJson()),
      isLoop: this.isLoop,
      edges: this.edges.map((e) => e.toJson()),
      pathBorders: this.pathBorders.map((e) => e.toJson()),
    };
  }

  static fromJson(json: any): Path {
    return new Path(
      json.nodes.map((n: any) => Node.fromJson(n)),
      json.isLoop,
      json.edges.map((e: any) => Edge.fromJson(e)),
      json.pathBorders.map((e: any) => Edge.fromJson(e)),
    );
  }
}
