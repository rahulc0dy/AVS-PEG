import { Edge } from "@/lib/primitives/edge";
import { Graph } from "@/lib/primitives/graph";
import { Node } from "@/lib/primitives/node";
import { isNode, NodeElement, OsmResponse } from "@/types/osm";
import { degToRad, invLerp } from "@/utils/math";

export function parseRoadsFromOsmData(osmData: OsmResponse): Graph {
  const osmNodes: Map<number, { node: Node }> = new Map();
  const osmEdges: Map<number, { edge: Edge }> = new Map();

  const nodes = osmData.elements.filter((e) => isNode(e)) as NodeElement[];

  const lats = nodes.map((n) => n.lat);
  const lons = nodes.map((n) => n.lon);

  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);

  const deltaLat = maxLat - minLat;
  const deltaLon = maxLon - minLon;
  const aspectRatio = deltaLon / deltaLat;
  const height = deltaLat * 111000 * 10;
  const width = height * aspectRatio * Math.cos(degToRad(maxLat));

  for (const node of nodes) {
    const y = invLerp(maxLat, minLat, node.lat) * height;
    const x = invLerp(minLon, maxLon, node.lon) * width;

    osmNodes.set(node.id, { node: new Node(x, y) });
  }

  osmNodes.set(0, { node: new Node(0, 0) }); // Add origin for testing

  const graph = new Graph(
    Array.from(osmNodes.values()).map((v) => v.node),
    []
  );

  console.log(graph);
  return graph;
}
