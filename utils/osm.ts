import { Edge } from "@/lib/primitives/edge";
import { Graph } from "@/lib/primitives/graph";
import { Node } from "@/lib/primitives/node";
import { isNode, NodeElement, OsmResponse, WayElement } from "@/types/osm";
import { degToRad, invLerp } from "@/utils/math";

export function parseRoadsFromOsmData(osmData: OsmResponse): Graph {
  const osmNodes: Map<number, Node> = new Map();
  const segments: Edge[] = [];

  const rawNodes = osmData.elements.filter((e) => isNode(e)) as NodeElement[];
  const ways = osmData.elements.filter((e) => e.type === "way") as WayElement[];

  // 1. Filter out nodes that aren't part of any way (road)
  // This prevents rendering thousands of unrelated points (trees, buildings, etc.)
  const usedNodeIds = new Set<number>();
  for (const way of ways) {
    for (const id of way.nodes) {
      usedNodeIds.add(id);
    }
  }

  const nodes = rawNodes.filter((n) => usedNodeIds.has(n.id));

  const lats = nodes.map((n) => n.lat);
  const lons = nodes.map((n) => n.lon);

  if (lats.length === 0 || lons.length === 0) {
    return new Graph([], []);
  }

  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);
  const deltaLat = maxLat - minLat;
  const deltaLon = maxLon - minLon;

  // Handle degenerate bounding boxes (single point or line)
  if (deltaLat === 0 || deltaLon === 0) {
    // Can't create a proper 2D graph from a line or point
    console.warn(
      "Degenerate bounding box: all nodes are collinear or coincident"
    );
    return new Graph([], []);
  }

  const aspectRatio = deltaLon / deltaLat;

  // Approximate meters per degree latitude: ~111km
  const METERS_PER_DEGREE_LAT = 111000;
  // Scale factor to convert to reasonable world coordinates (adjustable)
  const SCALE_FACTOR = 4;

  const height = deltaLat * METERS_PER_DEGREE_LAT * SCALE_FACTOR;

  // Use center latitude for more accurate cosine correction
  const centerLat = (minLat + maxLat) / 2;
  const width = height * aspectRatio * Math.cos(degToRad(centerLat));

  // 2. Create Nodes
  for (const node of nodes) {
    // Center the graph at (0,0) by offsetting by half width/height
    const y = invLerp(maxLat, minLat, node.lat) * height - height / 2;
    const x = invLerp(minLon, maxLon, node.lon) * width - width / 2;

    osmNodes.set(node.id, new Node(x, y));
  }

  // 3. Create Segments from Ways
  for (const way of ways) {
    const wayIds = way.nodes;
    for (let i = 1; i < wayIds.length; i++) {
      const prevNode = osmNodes.get(wayIds[i - 1]);
      const currNode = osmNodes.get(wayIds[i]);

      if (prevNode && currNode) {
        segments.push(new Edge(prevNode, currNode));
      }
    }
  }

  return new Graph(Array.from(osmNodes.values()), segments);
}
