import { Car } from "@/lib/car/car";
import { getIntersection, Intersection, lerp } from "@/utils/math";
import { Edge } from "@/lib/primitives/edge";
import { Node } from "@/lib/primitives/node";
import {
  BufferGeometry,
  Float32BufferAttribute,
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
    // Construct ray segments in world coordinates. Rays are distributed
    // evenly across `raySpreadAngle` and rotated by the car's heading.
    this.rays = [];
    for (let i = 0; i < this.rayCount; i++) {
      const rayAngle =
        lerp(
          this.raySpreadAngle / 2,
          -this.raySpreadAngle / 2,
          this.rayCount == 1 ? 0.5 : i / (this.rayCount - 1)
        ) - this.car.angle;

      const start = new Node(this.car.position.x, this.car.position.y);
      const end = new Node(
        this.car.position.x + Math.sin(rayAngle) * this.rayLength,
        this.car.position.y - Math.cos(rayAngle) * this.rayLength
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
    let touches = [];

    for (let i = 0; i < traffic.length; i++) {
      const poly = traffic[i].polygon;
      if (poly === null) continue;
      for (let j = 0; j < poly.nodes.length; j++) {
        const value = getIntersection(
          ray.n1,
          ray.n2,
          poly.nodes[j],
          poly.nodes[(j + 1) % poly.nodes.length]
        );
        if (value) {
          touches.push(value);
        }
      }
    }

    if (touches.length == 0) {
      return null;
    } else {
      const offsets = touches.map((e) => e.offset);
      const minOffset = Math.min(...offsets);
      return touches.find((e) => e.offset == minOffset);
    }
  }
  /**
   * Draw debug lines for the sensor rays into `group`.
   *
   * Rays are drawn at world Y=2 and Node.y is mapped directly to Three.js
   * Z when creating the line vertices.
   *
   * @param group Parent Three.js `Group` to which the debug lines are added
   */
  draw(group: Group) {
    // Add sensorGroup to the scene (once) and draw lines for each ray.
    if (!this.sensorGroup.parent) {
      group.add(this.sensorGroup);
    }
    this.sensorGroup.clear(); // Clear previous lines

    for (let i = 0; i < this.rayCount; i++) {
      if (!this.rays[i]) continue;

      const endPos = this.readings[i]
        ? { x: this.readings[i]!.x, y: this.readings[i]!.y }
        : this.rays[i].n2;

      // Map Node.y directly to Three.js Z when drawing (sensor lines sit at y=2)
      const points = [
        this.rays[i].n1.x,
        2,
        this.rays[i].n1.y,
        endPos.x,
        2,
        endPos.y,
      ];

      const geometry = new BufferGeometry();
      geometry.setAttribute("position", new Float32BufferAttribute(points, 3));

      const material = new LineBasicMaterial({
        color: this.readings[i] ? 0xff0000 : 0xffff00, // Red if hit, yellow otherwise
        linewidth: 2,
      });

      const line = new Line(geometry, material);
      this.sensorGroup.add(line);
    }
  }

  dispose() {
    // Remove debug visuals and detach from parent.
    this.sensorGroup.clear();
    if (this.sensorGroup.parent) {
      this.sensorGroup.parent.remove(this.sensorGroup);
    }
  }
}
