import { Graph } from "./graph";
import {
  Group,
  Mesh,
  MeshStandardMaterial,
  BoxGeometry,
  Vector3,
  Shape,
  ShapeGeometry,
  Vector2,
} from "three";

export type RoadVisualOptions = {
  roadWidth?: number;
  laneLine?: boolean;
  laneLineColor?: number;
  roundness?: number; // number of segments used to approximate end arcs (higher = smoother)
  dashLength?: number; // override dash length in world units
  gapLength?: number; // override gap length in world units
  dashThickness?: number; // override dash thickness (across road)
};

/**
 * Create a Three.js Group containing simple road meshes and center lines
 * from a Graph snapshot. This is a lightweight visual helper that converts
 * graph edges into flat quads (roads) on the XZ plane and an optional center
 * line for each edge.
 */
export function createRoadGroup(
  graph: Graph,
  {
    roadWidth = 4,
    laneLine = true,
    laneLineColor = 0xffffff,
    roundness = 8,
    dashLength: optDashLength,
    gapLength: optGapLength,
    dashThickness: optDashThickness,
  }: RoadVisualOptions = {}
): Group {
  const group = new Group();

  const snap = graph.snapshot();
  const nodes = new Map(snap.nodes.map((n) => [n.id, n] as [string, any]));

  for (const e of snap.edges) {
    const n1 = nodes.get(e.source);
    const n2 = nodes.get(e.target);
    if (!n1 || !n2) continue;

    // Map graph coordinates to Three.js XZ plane. GraphNode uses x,y,z: y is vertical.
    const x1 = Number(n1.x ?? 0);
    const z1 = Number(n1.z ?? 0);
    const x2 = Number(n2.x ?? 0);
    const z2 = Number(n2.z ?? 0);

    // Create a rounded road shape per edge using THREE.Shape. We'll build the perimeter
    // in XZ and then create a ShapeGeometry (in XY) and rotate it onto XZ plane.
    const dx = x2 - x1;
    const dz = z2 - z1;
    const len = Math.sqrt(dx * dx + dz * dz) || 1;
    const ux = dx / len;
    const uz = dz / len;
    // perpendicular (to the right of the direction)
    const px = -uz;
    const pz = ux;
    const half = roadWidth / 2;

    const hx = px * half;
    const hz = pz * half;

    // angles for arc generation (in world XY mapping: we treat X as x and Y as z for the shape)
    const angle = Math.atan2(dz, dx);
    const anglePerp = angle + Math.PI / 2;
    const anglePerpOpp = angle - Math.PI / 2;

  const arcSteps = Math.max(4, Math.floor(roundness));

    // Helper to push arc points around a center (cx, cz)
    const makeArc = (cx: number, cz: number, startAng: number, endAng: number, radius: number) => {
      const points: Vector2[] = [];
      const step = (endAng - startAng) / arcSteps;
      for (let i = 0; i <= arcSteps; i++) {
        const a = startAng + step * i;
        const px = cx + Math.cos(a) * radius;
        const py = cz + Math.sin(a) * radius; // using py to represent Z in shape's Y
        points.push(new Vector2(px, py));
      }
      return points;
    };

    // Build perimeter points in order: start cap (left->right), outer edge to end, end cap, inner edge back
    const startLeft = { x: x1 + hx, z: z1 + hz };
    const startRight = { x: x1 - hx, z: z1 - hz };
    const endLeft = { x: x2 + hx, z: z2 + hz };
    const endRight = { x: x2 - hx, z: z2 - hz };

    // Angles for caps: compute arc from right side to left side around start and end
    // For start cap, span from anglePerpOpp to anglePerp
    const startArc = makeArc(x1, z1, anglePerpOpp, anglePerp, half);
    // Outer edge: from startLeft -> endLeft (straight line)
    const outer = [new Vector2(endLeft.x, endLeft.z)];
    // End cap: from anglePerp to anglePerpOpp around end
    const endArc = makeArc(x2, z2, anglePerp, anglePerpOpp, half);
    // Inner edge: from endRight -> startRight
    const inner = [new Vector2(startRight.x, startRight.z)];

    const shape = new Shape();
    // move to first point of startArc
    if (startArc.length > 0) shape.moveTo(startArc[0].x, startArc[0].y);
    // add start cap
    for (let p of startArc) shape.lineTo(p.x, p.y);
    // outer edge to end
    for (let p of outer) shape.lineTo(p.x, p.y);
    // add end cap
    for (let p of endArc) shape.lineTo(p.x, p.y);
    // inner edge back to start
    for (let p of inner) shape.lineTo(p.x, p.y);
    shape.closePath();

    const geom = new ShapeGeometry(shape);
    // ShapeGeometry is in XY; rotate to XZ plane by rotating around X axis
    const mat = new MeshStandardMaterial({
      color: 0x333333,
      metalness: 0.1,
      roughness: 0.9,
      side: 2,
    });
    const mesh = new Mesh(geom, mat);
    mesh.rotation.x = Math.PI / 2;
    mesh.position.y = 0.001; // slight offset to avoid z-fighting with grid
    group.add(mesh);

    if (laneLine) {
      // Create a thick dashed center line using many thin box meshes to guarantee
      // consistent thickness across platforms (lines' linewidth is not reliable).
      // Heuristic dash/gap sizing: base on roadWidth but clamp to sensible ranges
      const available = len;
      // base sizes (allow overrides from options)
      const baseDash = typeof optDashLength === "number" ? optDashLength : roadWidth * 0.4;
      const baseGap = typeof optGapLength === "number" ? optGapLength : roadWidth * 0.6;
      // clamp dash length to [0.2, available/2]
      const dashLen = Math.min(Math.max(baseDash, 0.2), Math.max(0.2, available / 2));
      // clamp gap length to [0.1, available/2]
      const gapLen = Math.min(Math.max(baseGap * 0.6, 0.1), Math.max(0.1, available / 2));
      // thickness (across road) should be a fraction of roadWidth but never exceed roadWidth
  // dash thickness: allow override, otherwise use a small fraction of roadWidth
  // reduced default to make dashes thinner and less visually heavy
  const segThickness = typeof optDashThickness === "number" ? optDashThickness : Math.max(0.02, roadWidth * 0.06);

      const pattern = dashLen + gapLen;
      const count = Math.max(0, Math.floor(available / pattern));
      const remainder = available - count * pattern;
      const offset = remainder / 2; // center pattern along segment

      for (let i = 0; i < count; i++) {
        const centerDist = offset + i * pattern + dashLen / 2;
        const cx = x1 + ux * centerDist;
        const cz = z1 + uz * centerDist;

        const segGeom = new BoxGeometry(dashLen, 0.02, segThickness);
        const segMat = new MeshStandardMaterial({ color: laneLineColor, emissive: laneLineColor, emissiveIntensity: 0.6 });
        const seg = new Mesh(segGeom, segMat);
        seg.position.set(cx, 0.02, cz);
        // Align segment X axis with the edge direction robustly using quaternion
        seg.quaternion.setFromUnitVectors(new Vector3(1, 0, 0), new Vector3(ux, 0, uz));
        group.add(seg);
      }
    }
  }

  return group;
}
