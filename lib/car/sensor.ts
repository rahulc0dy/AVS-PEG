import { Car } from "@/lib/car/car";
import { getIntersection, Intersection, lerp } from "@/utils/math";
import { Edge } from "@/lib/primitives/edge";
import { Node } from "@/lib/primitives/node";
import {
  BufferAttribute,
  BufferGeometry,
  Group,
  Line,
  LineBasicMaterial,
} from "three";

/**
 * Sensor suite attached to a `Car` that casts multiple rays and reports the
 * closest intersection along each ray. The sensor does not perform physics
 * itself — it only performs geometric intersection tests against other cars' polygons.
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
  readings: (Intersection | null | undefined)[];

  /** Three.js Group used to render debug lines for the rays. */
  private sensorGroup: Group;

  /** Cached Three.js line meshes, 1:1 with ray index. */
  private rayLines: Array<Line<BufferGeometry, LineBasicMaterial>>;

  /**
   * Create a Sensor attached to `car`.
   * @param car Owner car that provides position/heading for casting rays.
   */
  constructor(car: Car) {
    this.car = car;
    this.rayCount = 10;
    this.rayLength = 50;
    this.raySpreadAngle = Math.PI / 2;

    this.rays = [];
    this.readings = [];
    this.sensorGroup = new Group();
    this.rayLines = [];
  }

  /**
   * Recompute rays and their closest intersection with other vehicles.
   *
   * The `traffic` array contains other cars whose polygons are tested
   * against each ray; `readings` is populated with the nearest hit (or
   * null if none).
   */
  update(traffic: Car[]) {
    this.castRays();
    this.readings = [];
    for (let i = 0; i < this.rays.length; i++) {
      this.readings.push(this.getReading(this.rays[i], traffic));
    }
  }

  /**
   * Build the ray segments in world coordinates.
   *
   * Rays are evenly distributed across `raySpreadAngle` and rotated by the
   * car's heading. Each ray is represented as an `Edge` (start/end `Node`).
   * This method updates the `rays` array.
   */
  private castRays() {
    this.rays = [];
    for (let i = 0; i < this.rayCount; i++) {
      const rayAngle =
        lerp(
          this.raySpreadAngle / 2,
          -this.raySpreadAngle / 2,
          this.rayCount == 1 ? 0.5 : i / (this.rayCount - 1),
        ) - this.car.angle;

      const start = new Node(this.car.position.x, this.car.position.y);
      const end = new Node(
        this.car.position.x + Math.sin(rayAngle) * this.rayLength,
        this.car.position.y - Math.cos(rayAngle) * this.rayLength,
      );
      this.rays.push(new Edge(start, end));
    }
  }

  /**
   * Find the closest intersection point between `ray` and any polygon in
   * `traffic`.
   *
   * @param ray - Ray segment to test
   * @param traffic - Array of other cars whose polygons will be tested
   * @returns The nearest `Intersection` along the ray, or `null` if none
   */
  private getReading(ray: Edge, traffic: Car[]) {
    const touches: Intersection[] = [];

    for (let i = 0; i < traffic.length; i++) {
      const poly = traffic[i].polygon;
      if (poly === null) continue;
      for (let j = 0; j < poly.nodes.length; j++) {
        const value = getIntersection(
          ray.n1,
          ray.n2,
          poly.nodes[j],
          poly.nodes[(j + 1) % poly.nodes.length],
        );
        if (value) {
          touches.push(value);
        }
      }
    }

    if (touches.length === 0) {
      return null;
    }

    const offsets = touches.map((e) => e.offset);
    const minOffset = Math.min(...offsets);
    return touches.find((e) => e.offset == minOffset);
  }

  /**
   * Ensure we have a cached line mesh (geometry + material) per ray.
   *
   * We allocate once and then only mutate the position attribute array in `draw()`.
   */
  private ensureRayLines() {
    // Grow pool
    for (let i = this.rayLines.length; i < this.rayCount; i++) {
      const geometry = new BufferGeometry();
      // 2 points (start/end) => 6 floats
      const positions = new Float32Array(6);
      geometry.setAttribute("position", new BufferAttribute(positions, 3));
      // Precompute bounds for frustum culling updates; will be recomputed on updates.
      geometry.computeBoundingSphere();

      const material = new LineBasicMaterial({
        color: 0xff0000,
        linewidth: 2,
      });

      const line = new Line(geometry, material);
      line.visible = false; // default: only show if we have a reading

      this.rayLines.push(line);
      this.sensorGroup.add(line);
    }

    // Shrink pool if rayCount reduced
    while (this.rayLines.length > this.rayCount) {
      const line = this.rayLines.pop();
      if (!line) break;
      this.sensorGroup.remove(line);
      line.geometry.dispose();
      line.material.dispose();
    }
  }

  /**
   * Draw debug lines for the sensor rays into `group`.
   *
   * Only rays with a valid `reading` are rendered; rays with no hit are hidden.
   */
  draw(group: Group) {
    // Add sensorGroup to the scene (once).
    if (!this.sensorGroup.parent) {
      group.add(this.sensorGroup);
    }

    this.ensureRayLines();

    for (let i = 0; i < this.rayCount; i++) {
      const ray = this.rays[i];
      const reading = this.readings[i] ?? null;
      const line = this.rayLines[i];

      // If we haven't updated rays/readings yet, or there's no intersection, don't render this one.
      if (!ray || !reading) {
        if (line) line.visible = false;
        continue;
      }

      // Visible only when intersection exists
      line.visible = true;

      // Map Node.y directly to Three.js Z when drawing (sensor lines sit at y=2)
      const positions = (
        line.geometry.getAttribute("position") as BufferAttribute
      ).array as Float32Array;

      positions[0] = ray.n1.x;
      positions[1] = 2;
      positions[2] = ray.n1.y;
      positions[3] = reading.x;
      positions[4] = 2;
      positions[5] = reading.y;

      const attr = line.geometry.getAttribute("position") as BufferAttribute;
      attr.needsUpdate = true;
      line.material.color.set(0xff0000);
      line.geometry.computeBoundingSphere();
    }
  }

  /**
   * Dispose sensor debug meshes/materials and detach from the scene.
   */
  dispose() {
    this.rayLines.forEach((line) => {
      line.geometry.dispose();
      line.material.dispose();
    });
    this.rayLines = [];

    this.sensorGroup.clear();
    if (this.sensorGroup.parent) {
      this.sensorGroup.parent.remove(this.sensorGroup);
    }
  }
}
