import { OsmResponse } from "@/types/osm";

/**
 * Fetch road data from Overpass API for a bounding box.
 *
 * This helper posts an Overpass QL query to the public interpreter and
 * returns the parsed JSON response. The query filters out many non-road
 * highway types (footpaths, cycleways, service roads, etc.) and skips
 * private/no-access ways.
 *
 * Note: the public Overpass endpoint imposes rate limits and usage
 * restrictions. For production or heavy usage consider running your own
 * Overpass instance or caching results.
 *
 * @param minLat - Minimum latitude of bounding box (south)
 * @param minLon - Minimum longitude of bounding box (west)
 * @param maxLat - Maximum latitude of bounding box (north)
 * @param maxLon - Maximum longitude of bounding box (east)
 * @returns Parsed Overpass JSON response matching `OsmResponse`
 * @throws When the network request fails or the server returns a non-OK status
 */
export async function getRoadData(
  minLat: number,
  minLon: number,
  maxLat: number,
  maxLon: number
): Promise<OsmResponse> {
  const bbox = `(${minLat},${minLon},${maxLat},${maxLon})`;

  // Overpass QL query: select ways with highway tag but exclude unwanted
  // subtypes. We also exclude private/no access ways.
  const query = `
            [out:json];
            (
              way['highway']
              ['highway' !~'pedestrian']
              ['highway' !~'footway']
              ['highway' !~'cycleway']
              ['highway' !~'path']
              ['highway' !~'service']
              ['highway' !~'corridor']
              ['highway' !~'track']
              ['highway' !~'steps']
              ['highway' !~'raceway']
              ['highway' !~'bridleway']
              ['highway' !~'proposed']
              ['highway' !~'construction']
              ['highway' !~'elevator']
              ['highway' !~'bus_guideway']
              ['access' !~'private']
              ['access' !~'no']
              ${bbox};
            );
            out body;
            >;
            out skel;
        `;

  const res = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    body: "data=" + encodeURIComponent(query),
    headers: {
      // Indicate form-encoded payload; Overpass accepts plain body too,
      // but adding content-type helps some proxies.
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
    },
  });

  if (!res.ok) throw new Error("Failed to fetch OSM data");

  const json = await res.json();

  console.log("OSM data fetched:", json);

  return json;
}
