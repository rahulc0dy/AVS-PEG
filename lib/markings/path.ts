import { Node } from "@/lib/primitives/node";
import { Edge } from "@/lib/primitives/edge";
import { EdgeJson, NodeJson, PathJson } from "@/types/save";
import { Graph } from "@/lib/primitives/graph";

/**
 * Represents a user-defined route made of ordered waypoint nodes.
 *
 * A `Path` stores the raw waypoint list along with the derived edge and border
 * geometry used by the path-finding overlay and serialization layer.
 */
export class Path {
  /** Ordered waypoint nodes that define the path. */
  waypoints: Node[];
  /** Whether the final waypoint connects back to the first waypoint. */
  isLoop: boolean;
  /** Derived centerline edges generated from the waypoint sequence. */
  edges: Edge[] = [];
  /** Derived border geometry generated from the centerline edges. */
  borders: Edge[] = [];
  /** Display color used when rendering the path in the editor. */
  color: string;

  /**
   * Create a path from pre-existing waypoint and derived geometry arrays.
   *
   * @param waypoints - Ordered waypoint nodes defining the path.
   * @param isLoop - Whether the path should connect the last waypoint back to the first.
   * @param edges - Optional precomputed centerline edges.
   * @param borders - Optional precomputed border edges.
   * @param color - Optional display color. A bright random HSL color is generated when omitted.
   */
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
    this.color = color || `hsl(${Math.floor(Math.random() * 360)}, 100%, 50%)`;
  }

  /**
   * Reconstruct a path from serialized JSON.
   *
   * Waypoint and edge references are resolved against the provided graph when
   * matching nodes or edges already exist there. This preserves shared object
   * identity with the graph instead of creating duplicate Node or Edge instances.
   *
   * @param json - Serialized path payload.
   * @param graph - Graph used to resolve matching nodes and edges.
   * @returns A hydrated `Path` instance.
   */
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
            (ge.isDirected === e.isDirected &&
              ge.n1.x === e.n1.x &&
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

  /**
   * Serialize this path to plain JSON data.
   *
   * The output contains only serializable node and edge payloads and can be
   * persisted directly or passed back into {@link Path.fromJson}.
   *
   * @returns A serialized representation of this path.
   */
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
