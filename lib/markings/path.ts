import { Node } from "@/lib/primitives/node";
import { Edge } from "@/lib/primitives/edge";
import { PathJson, NodeJson, EdgeJson } from "@/types/save";
import { Graph } from "../primitives/graph";

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
    // Generate a prominent, bright color shifting only the hue
    this.color =
      color ||
      `hsl(${Math.floor(Math.random() * 360)}, 100%, 50%)`;
  }

  static fromJson(json: PathJson, graph: Graph): Path {
    const graphNodes = graph.getNodes();
    const graphEdges = graph.getEdges();

    const waypoints = json.waypoints.map((n: NodeJson) => {
      if (graphNodes) {
        const match = graphNodes.find((gn) => gn.x === n.x && gn.y === n.y);
        if (match) return match;
      }
      return Node.fromJson(n);
    });

    const edges = json.edges.map((e: EdgeJson) => {
      if (graphEdges) {
        const match = graphEdges.find(
          (ge) =>
            (ge.n1.x === e.n1.x &&
              ge.n1.y === e.n1.y &&
              ge.n2.x === e.n2.x &&
              ge.n2.y === e.n2.y) ||
            (!ge.isDirected &&
              !e.isDirected &&
              ge.n1.x === e.n2.x &&
              ge.n1.y === e.n2.y &&
              ge.n2.x === e.n1.x &&
              ge.n2.y === e.n1.y),
        );
        if (match) return match;
      }

      const n1 =
        graphNodes?.find((gn) => gn.x === e.n1.x && gn.y === e.n1.y) ||
        Node.fromJson(e.n1);
      const n2 =
        graphNodes?.find((gn) => gn.x === e.n2.x && gn.y === e.n2.y) ||
        Node.fromJson(e.n2);
      return new Edge(n1, n2, e.isDirected ?? false);
    });

    return new Path(
      waypoints,
      json.isLoop,
      edges,
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
