import { Car } from "@/lib/car/car";
import { Edge } from "@/lib/primitives/edge";
import {
  BufferGeometry,
  CanvasTexture,
  DoubleSide,
  Float32BufferAttribute,
  Group,
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
function createBeamGradientTexture(
  r: number,
  g: number,
  b: number,
  peakAlpha: number = 0.7,
): CanvasTexture {
  const width = 256;
  const height = 1;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;

  const gradient = ctx.createLinearGradient(0, 0, width, 0);
  gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${peakAlpha})`);
  gradient.addColorStop(0.3, `rgba(${r}, ${g}, ${b}, ${peakAlpha * 0.5})`);
  gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0.0)`);

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

  /** Shared material for clear (no-hit) beam wedges — yellow gradient. */
  private clearMaterial: MeshBasicMaterial;

  /** Shared material for hit-detected beam wedges — red gradient. */
  private hitMaterial: MeshBasicMaterial;

  /** Gradient texture for clear beam wedges. */
  private clearTexture: CanvasTexture;

  /** Gradient texture for hit beam wedges. */
  private hitTexture: CanvasTexture;

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
    this.sensorGroup.add(this.beamGroup);

    /** Shared polygonOffset config so beams render above the road surface. */
    const beamMaterialConfig = {
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    } as const;

    this.clearTexture = createBeamGradientTexture(255, 220, 30, 0.7);
    this.clearMaterial = new MeshBasicMaterial({
      map: this.clearTexture,
      ...beamMaterialConfig,
    });

    this.hitTexture = createBeamGradientTexture(255, 50, 50, 0.8);
    this.hitMaterial = new MeshBasicMaterial({
      map: this.hitTexture,
      ...beamMaterialConfig,
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
  }

  /**
   * Build or update one filled triangular wedge per sensor ray. Each wedge is
   * a narrow angular segment centred on the ray's direction, with angular
   * width equal to the total spread divided by the ray count. The origin
   * vertex gets UV `u = 0` (opaque) and the two tip vertices get `u = 1`
   * (transparent), producing the radar fade via the gradient texture.
   *
   * When a ray detects a non-border obstacle, its wedge is shortened to
   * the intersection distance and coloured red.
   */
  private drawBeamWedges() {
    const halfSegment =
      this.rayCount > 1
        ? this.raySpreadAngle / (this.rayCount - 1) / 2
        : this.raySpreadAngle / 4;

    for (let i = 0; i < this.rayCount; i++) {
      if (!this.rays[i]) continue;

      const origin = this.rays[i].n1;

      // Determine ray length — shorten to hit distance if non-border hit
      const reading = this.readings[i];
      const intersection = reading?.intersection;
      const hasHit = !!(
        reading && reading.label !== "border" && intersection
      );
      const effectiveLength = hasHit
        ? intersection.offset * this.rayLength
        : this.rayLength;

      // Compute the ray's centre angle from its endpoint direction
      const dx = this.rays[i].n2.x - origin.x;
      const dy = this.rays[i].n2.y - origin.y;
      const rayAngle = Math.atan2(dy, dx);

      // Two edges of the angular segment
      const leftAngle = rayAngle - halfSegment;
      const rightAngle = rayAngle + halfSegment;

      const endLeft = new Node(
        origin.x + Math.cos(leftAngle) * effectiveLength,
        origin.y + Math.sin(leftAngle) * effectiveLength,
      );
      const endRight = new Node(
        origin.x + Math.cos(rightAngle) * effectiveLength,
        origin.y + Math.sin(rightAngle) * effectiveLength,
      );

      // Triangle: origin → endLeft → endRight
      const positions = new Float32Array([
        origin.x, SENSOR_DRAW_HEIGHT, origin.y,
        endLeft.x, SENSOR_DRAW_HEIGHT, endLeft.y,
        endRight.x, SENSOR_DRAW_HEIGHT, endRight.y,
      ]);

      // UV mapping: u=0 at origin (opaque), u=1 at tips (transparent)
      const uvs = new Float32Array([
        0, 0.5, // origin — left edge of gradient
        1, 0, // tip left  — right edge of gradient
        1, 1, // tip right — right edge of gradient
      ]);

      const material = hasHit ? this.hitMaterial : this.clearMaterial;

      let mesh = this.beamGroup.children[i] as Mesh;

      if (mesh) {
        mesh.geometry.setAttribute(
          "position",
          new Float32BufferAttribute(positions, 3),
        );
        mesh.geometry.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
        mesh.material = material;
        mesh.geometry.computeBoundingSphere();
      } else {
        const geometry = new BufferGeometry();
        geometry.setAttribute(
          "position",
          new Float32BufferAttribute(positions, 3),
        );
        geometry.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
        mesh = new Mesh(geometry, material);
        mesh.frustumCulled = false;
        this.beamGroup.add(mesh);
      }
    }

    // Remove excess wedge meshes if ray count was reduced
    this.pruneChildren(this.beamGroup, this.rayCount);
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

    // Dispose shared materials and textures
    this.clearMaterial.dispose();
    this.clearTexture.dispose();
    this.hitMaterial.dispose();
    this.hitTexture.dispose();

    this.sensorGroup.clear();
    if (this.sensorGroup.parent) {
      this.sensorGroup.parent.remove(this.sensorGroup);
    }
  }
}
