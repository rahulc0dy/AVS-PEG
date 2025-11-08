export type NodeId = string;
export type EdgeId = string;

export interface GraphNode {
  id: NodeId;
  label?: string;
  // 3D position for convenience; renderer can project/mutate this,
  // but model remains the source of truth.
  x: number;
  y: number;
  z: number;
}

export interface GraphEdge {
  id: EdgeId;
  source: NodeId;
  target: NodeId;
  directed?: boolean;
  weight?: number;
}

export interface GraphSnapshot {
  nodes: GraphNode[];
  edges: GraphEdge[];
}
