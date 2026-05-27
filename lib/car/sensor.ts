import { Car } from "@/lib/car/car";
import { Edge } from "@/lib/primitives/edge";
import {
  BufferGeometry,
  CanvasTexture,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  Line,
  LineBasicMaterial,
  Mesh,
  MeshBasicMaterial,
  Object3D,
} from "three";
import { EdgeJson } from "@/types/save";
import { LabelledIntersection } from "@/types/intersection";
import { Node } from "@/lib/primitives/node";

/**
 * Y-height at which sensor beam visuals are drawn in the Three.js scene.
 *
 * Set just above the road overlay layer (0.03) but below car model origins (0)
 * — the polygon offset handles the actual depth ordering so this only needs to
 * be in roughly the right range.
 */
const SENSOR_DRAW_HEIGHT = 0.05;

/**
 * Creates a 1-D gradient CanvasTexture that fades from semi-opaque to fully
 * transparent. Used to UV-map onto beam triangles so the origin vertex is
 * bright and the tips fade out.
 *
 * @returns A Three.js CanvasTexture with a horizontal opacity gradient.
 */
function createBeamGradientTexture(): CanvasTexture {
  const width = 256;
  const height = 1;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;

  const gradient = ctx.createLinearGradient(0, 0, width, 0);
  // Left edge = origin (opaque yellow), right edge = tip (fully transparent)
  gradient.addColorStop(0, "rgba(255, 220, 30, 0.7)");
  gradient.addColorStop(0.3, "rgba(255, 200, 10, 0.35)");
  gradient.addColorStop(1, "rgba(255, 200, 10, 0.0)");

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  const texture = new CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

/**
 * Sensor suite attached to a `Car` that casts multiple rays and reports the
 * closest intersection along each ray. The sensor does not perform physics
 * itself — it only performs geometric intersection tests against other cars'
 * polygons.
 *
 * Visually, the sensor renders as a filled radar-style beam that fades from
 * semi-opaque near the car to fully transparent at the maximum ray distance,
 * with red cross-hair indicators overlaid where non-border intersections occur.
 *
 * Uses `polygonOffset` to sit above the road surface without disabling depth
 * testing, so the beam correctly renders above the road but behind the car.
 */
export class Sensor {
  /** Owning car instance (provides position and heading). */
  car: Car;
  /** Number of rays to cast per update. */
  rayCount: number;
  /** Maximum length of each ray in world units. */
  rayLength: number;
  /** Angular spread (radians) across which rays are cast, centred on car heading. */
  raySpreadAngle: number;

  /** Ray segments represented as `Edge`s (start/end Nodes in world coords). */
  rays: Edge[];
  /** Cached intersection readings for each ray (null if no hit). */
  readings: (LabelledIntersection | null)[];
  /** Toggle car detection */
  ignoreTraffic: boolean = false;

  /** Three.js Group used to render the radar beam and hit-point visuals. */
  private sensorGroup: Group;

  /** Sub-group holding the filled beam wedge meshes (one per adjacent ray pair). */
  private beamGroup: Group;

  /** Sub-group holding the hit-point indicator lines. */
  private hitGroup: Group;

  /** Shared material for the radar beam fill (uses gradient texture + polygonOffset). */
  private beamMaterial: MeshBasicMaterial;

  /** Shared material for hit-point indicator lines. */
  private hitMaterial: LineBasicMaterial;

  /** Gradient texture applied to beam wedges. */
  private beamTexture: CanvasTexture;

  /**
   * Create a Sensor attached to `car`.
   * @param car Owner car that provides position/heading for casting rays.
   */
  constructor(car: Car) {
    this.car = car;
    this.rayCount = 5;
    this.rayLength = 60;
    this.raySpreadAngle = Math.PI / 1.5;

    this.rays = [];
    this.readings = [];
    this.sensorGroup = new Group();
    this.beamGroup = new Group();
    this.hitGroup = new Group();
    this.sensorGroup.add(this.beamGroup);
    this.sensorGroup.add(this.hitGroup);

    this.beamTexture = createBeamGradientTexture();

    this.beamMaterial = new MeshBasicMaterial({
      map: this.beamTexture,
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
      // Push the beam forward in the depth buffer so it wins over
      // the road surface and lane overlays without disabling depthTest
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });

    this.hitMaterial = new LineBasicMaterial({
      color: 0xff3333,
      linewidth: 2,
    });
  }

  /**
   * Update sensor state with readings computed by the worker thread.
   *
   * This method receives pre-computed ray segments and intersection readings
   * from the car worker, avoiding expensive intersection tests on the main thread.
   *
   * @param rays - Ray segments computed by the worker
   * @param readings - Intersection readings for each ray (null if no hit)
   */
  update(rays: EdgeJson[], readings: (LabelledIntersection | null)[]) {
    this.rays = rays.map((rayJson) => {
      return Edge.fromJson(rayJson);
    });
    this.readings = readings;
  }

  /**
   * Render the radar-style sensor beam and hit-point indicators into `group`.
   *
   * For each pair of adjacent rays a filled triangle wedge is drawn from the
   * car position to the two ray endpoints, UV-mapped so that a gradient
   * texture fades the fill from opaque at the origin to transparent at the
   * tips. A red cross-hair line is drawn at each non-border intersection.
   *
   * @param group Parent Three.js `Group` to which visuals are added
   */
  draw(group: Group) {
    if (!this.sensorGroup.parent) {
      group.add(this.sensorGroup);
    }

    this.drawBeamWedges();
    this.drawHitIndicators();
  }

  /**
   * Build or update filled triangular wedge meshes between each pair of
   * adjacent sensor rays. The origin vertex gets UV `u = 0` (opaque) and
   * the tip vertices get `u = 1` (transparent), mapping onto the gradient
   * texture to produce the radar fade effect.
   */
  private drawBeamWedges() {
    const wedgeCount = Math.max(0, this.rayCount - 1);

    for (let i = 0; i < wedgeCount; i++) {
      if (!this.rays[i] || !this.rays[i + 1]) continue;

      const origin = this.rays[i].n1;
      const endA = this.getEffectiveEnd(i);
      const endB = this.getEffectiveEnd(i + 1);

      // Triangle: origin → endA → endB
      const positions = new Float32Array([
        origin.x, SENSOR_DRAW_HEIGHT, origin.y,
        endA.x,   SENSOR_DRAW_HEIGHT, endA.y,
        endB.x,   SENSOR_DRAW_HEIGHT, endB.y,
      ]);

      // UV mapping: u=0 at origin (opaque), u=1 at tips (transparent)
      const uvs = new Float32Array([
        0, 0.5,  // origin — left edge of gradient
        1, 0,    // tip A  — right edge of gradient
        1, 1,    // tip B  — right edge of gradient
      ]);

      let mesh = this.beamGroup.children[i] as Mesh;

      if (mesh) {
        mesh.geometry.setAttribute(
          "position",
          new Float32BufferAttribute(positions, 3),
        );
        mesh.geometry.setAttribute(
          "uv",
          new Float32BufferAttribute(uvs, 2),
        );
        mesh.geometry.computeBoundingSphere();
      } else {
        const geometry = new BufferGeometry();
        geometry.setAttribute(
          "position",
          new Float32BufferAttribute(positions, 3),
        );
        geometry.setAttribute(
          "uv",
          new Float32BufferAttribute(uvs, 2),
        );
        mesh = new Mesh(geometry, this.beamMaterial);
        mesh.frustumCulled = false;
        this.beamGroup.add(mesh);
      }
    }

    // Remove excess wedge meshes if ray count was reduced
    this.pruneChildren(this.beamGroup, wedgeCount);
  }

  /**
   * Draw red cross-hair indicators at each non-border intersection point,
   * rendered as short perpendicular line segments at the intersection
   * location.
   */
  private drawHitIndicators() {
    let hitIdx = 0;

    for (let i = 0; i < this.rayCount; i++) {
      if (!this.rays[i]) continue;

      const reading = this.readings[i];
      const intersection = reading?.intersection;
      const showHit = reading && reading.label !== "border" && intersection;

      if (!showHit) continue;

      const hitPos = new Node(intersection.x, intersection.y);
      const ray = this.rays[i];
      const dx = ray.n2.x - ray.n1.x;
      const dy = ray.n2.y - ray.n1.y;
      const len = Math.hypot(dx, dy);
      const crossSize = 2.5;
      const px = (-dy / len) * crossSize;
      const py = (dx / len) * crossSize;

      const points = new Float32Array([
        hitPos.x - px, SENSOR_DRAW_HEIGHT + 0.02, hitPos.y - py,
        hitPos.x + px, SENSOR_DRAW_HEIGHT + 0.02, hitPos.y + py,
      ]);

      let line = this.hitGroup.children[hitIdx] as Line<
        BufferGeometry,
        LineBasicMaterial
      >;

      if (line) {
        line.geometry.setAttribute(
          "position",
          new Float32BufferAttribute(points, 3),
        );
        line.geometry.computeBoundingSphere();
        line.visible = true;
      } else {
        const geometry = new BufferGeometry();
        geometry.setAttribute(
          "position",
          new Float32BufferAttribute(points, 3),
        );
        line = new Line(geometry, this.hitMaterial);
        this.hitGroup.add(line);
      }
      hitIdx++;
    }

    // Hide surplus hit indicators
    for (let j = hitIdx; j < this.hitGroup.children.length; j++) {
      this.hitGroup.children[j].visible = false;
    }
  }

  /**
   * Get the effective endpoint for ray `i`, clamped to the intersection
   * point if a non-border hit is detected.
   *
   * @param i - Ray index
   * @returns Effective endpoint Node
   */
  private getEffectiveEnd(i: number): Node {
    const reading = this.readings[i];
    const intersection = reading?.intersection;
    if (reading && reading.label !== "border" && intersection) {
      return new Node(intersection.x, intersection.y);
    }
    return this.rays[i].n2;
  }

  /**
   * Remove excess children from a Three.js group, disposing their geometries.
   *
   * @param parent - Group to prune
   * @param keepCount - Number of children to retain
   */
  private pruneChildren(parent: Group, keepCount: number) {
    while (parent.children.length > keepCount) {
      const child = parent.children.pop() as Object3D & {
        geometry?: BufferGeometry;
      };
      if (child?.geometry) {
        child.geometry.dispose();
      }
    }
  }

  /**
   * Dispose sensor meshes/materials/textures and detach from the scene.
   */
  dispose() {
    // Dispose beam wedge geometries
    this.beamGroup.children.forEach((child) => {
      const mesh = child as Mesh;
      if (mesh.geometry) {
        mesh.geometry.dispose();
      }
    });
    this.beamGroup.clear();

    // Dispose hit indicator geometries
    this.hitGroup.children.forEach((child) => {
      const line = child as Line;
      if (line.geometry) {
        line.geometry.dispose();
      }
    });
    this.hitGroup.clear();

    // Dispose shared materials and texture
    this.beamMaterial.dispose();
    this.beamTexture.dispose();
    this.hitMaterial.dispose();

    this.sensorGroup.clear();
    if (this.sensorGroup.parent) {
      this.sensorGroup.parent.remove(this.sensorGroup);
    }
  }
}
