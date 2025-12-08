import { Color, Group } from "three";
import { Edge } from "@/lib/primitives/edge";
import { Node } from "@/lib/primitives/node";
import { GraphJson } from "@/types/save";

/**
 * Simple graph container for `Node`s and `Edge`s with a change counter.
 *
 * The class provides methods to add/remove nodes and edges, query
 * containment, and draw nodes into a Three.js `Group`.
 */
export class Graph {
  /** Node list maintained by the graph. */
  private nodes: Node[];
  /** Edge list maintained by the graph. */
  private edges: Edge[];

  /** Internal change counter; incremented whenever the graph mutates. */
  private changes: number;

  /**
   * Create a new Graph instance.
   * @param nodes - Initial list of nodes
   * @param edges - Initial list of edges
   */
  constructor(nodes: Node[], edges: Edge[]) {
    this.nodes = nodes;
    this.edges = edges;
    this.changes = 0;
  }

  /**
   * Increment the internal change counter. Used internally when the graph
   * structure is modified.
   */
  private incChanges() {
    this.changes += 1;
  }

  /**
   * Get the number of structural changes made to this graph.
   * @returns change count
   */
  getChanges(): number {
    return this.changes;
  }

  /**
   * Load new nodes and edges, replacing the current state.
   * Disposes of existing Three.js resources to prevent memory leaks.
   * @param nodes New nodes
   * @param edges New edges
   */
  load(nodes: Node[], edges: Edge[]) {
    // Dispose old resources
    for (const node of this.nodes) node.dispose();
    for (const edge of this.edges) edge.dispose();

    this.nodes = nodes;
    this.edges = edges;
    this.incChanges();
  }

  /**
   * Mark the graph as modified (increment change count).
   */
  touch() {
    this.incChanges();
  }

  /**
   * Retrieve the array of nodes.
   * @returns nodes array (direct reference)
   */
  getNodes(): Node[] {
    return this.nodes;
  }

  /**
   * Add a node to the graph and increment the change counter.
   * @param node - Node to add
   */
  private addNode(node: Node) {
    this.nodes.push(node);
    this.incChanges();
  }

  /**
   * Find a node in the graph that equals the provided node.
   * @param node - Node to find
   * @returns The matching node or `null` if not present
   */
  containsNode(node: Node): Node | null {
    return this.nodes.find((p) => p.equals(node)) ?? null;
  }

  /**
   * Attempt to add `node` if an equal node is not already present.
   * @param node - Node to insert
   * @returns The node when added, otherwise `null` when it already exists
   */
  tryAddNode(node: Node): Node | null {
    if (!this.containsNode(node)) {
      this.addNode(node);
      return node;
    }
    return null;
  }

  /**
   * Remove `node` and any incident edges from the graph. Disposes of the
   * removed node and increments the change counter.
   * @param node - Node to remove
   */
  removeNode(node: Node) {
    const edges = this.getEdgesWithNode(node);
    for (const edge of edges) {
      this.removeEdge(edge);
    }

    const nodeIndex = this.nodes.indexOf(node);
    if (nodeIndex != -1) {
      const [removedNode] = this.nodes.splice(nodeIndex, 1);
      removedNode.dispose();
      this.incChanges();
    }
  }

  /**
   * Retrieve the array of edges.
   * @returns edges array (direct reference)
   */
  getEdges(): Edge[] {
    return this.edges;
  }

  /**
   * Add an edge to the graph and increment change count.
   * @param edge - Edge to add
   */
  private addEdge(edge: Edge) {
    this.edges.push(edge);
    this.incChanges();
  }

  /**
   * Find an edge in the graph that equals the provided edge.
   * @param edge - Edge to find
   * @returns The matching edge or `undefined` if not present
   */
  containsEdge(edge: Edge) {
    return this.edges.find((e) => e.equals(edge));
  }

  /**
   * Attempt to add an edge if it does not already exist and is not a
   * self-loop (n1 !== n2).
   * @param edge - Edge to insert
   * @returns `true` if the edge was added; `false` otherwise
   */
  tryAddEdge(edge: Edge) {
    if (!this.containsEdge(edge) && !edge.n1.equals(edge.n2)) {
      this.addEdge(edge);
      return true;
    }
    return false;
  }

  addAllEdges() {
    for (let i = 0; i < this.nodes.length; i++) {
      for (let j = i + 1; j < this.nodes.length; j++) {
        const edge = new Edge(this.nodes[i], this.nodes[j]);
        this.tryAddEdge(edge);
      }
    }
  }

  addAllEdgesAmongConnectedComponents() {
    const visited: Set<Node> = new Set();

    // TODO: create utility function for connected components
    const components: Node[][] = [];
    for (const node of this.nodes) {
      if (!visited.has(node)) {
        const component: Node[] = [];

        // TODO: create utility function for DFS and BFS
        const stack: Node[] = [node];
        while (stack.length > 0) {
          const current = stack.pop()!;
          if (!visited.has(current)) {
            visited.add(current);
            component.push(current);
            const neighbors = this.getEdgesWithNode(current).map((e) =>
              e.n1.equals(current) ? e.n2 : e.n1,
            );
            for (const neighbor of neighbors) {
              if (!visited.has(neighbor)) {
                stack.push(neighbor);
              }
            }
          }
        }
        components.push(component);
      }
    }

    for (const component of components) {
      for (let i = 0; i < component.length; i++) {
        for (let j = i + 1; j < component.length; j++) {
          const edge = new Edge(component[i], component[j]);
          this.tryAddEdge(edge);
        }
      }
    }
  }

  /**
   * Remove `edge` from the graph, dispose it, and increment change count.
   * @param edge - Edge to remove
   */
  removeEdge(edge: Edge) {
    const edgeIndex = this.edges.indexOf(edge);
    if (edgeIndex !== -1) {
      const [removedEdge] = this.edges.splice(edgeIndex, 1);
      removedEdge.dispose();
      this.incChanges();
    }
  }

  /**
   * Get all edges incident on `node`.
   * @param node - Node whose incident edges are requested
   * @returns Array of incident edges
   */
  getEdgesWithNode(node: Node) {
    const edges: Edge[] = [];
    for (const edge of this.edges) {
      if (edge.includes(node)) {
        edges.push(edge);
      }
    }
    return edges;
  }

  /**
   * Draw the graph's nodes into the provided `Group` (currently uses a
   * fixed size and color for debugging/visualization).
   * @param group - Three.js group to add node meshes to
   */
  draw(group: Group) {
    for (const node of this.nodes) {
      node.draw(group, { size: 10, color: new Color(0xffffff) });
    }
  }

  /**
   * Serialize the graph to a plain JSON object containing nodes and edges.
   */
  toJson() {
    return {
      nodes: this.nodes.map((n) => n.toJson()),
      edges: this.edges.map((e) => e.toJson()),
    };
  }

  /**
   * Populate the graph from serialized JSON. Reconstructs `Node` and `Edge`
   * instances and replaces the current graph state.
   * @param json Serialized graph data
   */
  fromJson(json: GraphJson) {
    const nodes: Node[] = json.nodes.map((n) => new Node(n.x, n.y));
    const edges: Edge[] = json.edges.map((e) => {
      const n1 =
        nodes.find((nd: Node) => nd.x === e.n1.x && nd.y === e.n1.y) ??
        new Node(e.n1.x, e.n1.y);
      const n2 =
        nodes.find((nd: Node) => nd.x === e.n2.x && nd.y === e.n2.y) ??
        new Node(e.n2.x, e.n2.y);
      return new Edge(n1, n2, e.isDirected ?? false);
    });

    this.load(nodes, edges);
  }
}
