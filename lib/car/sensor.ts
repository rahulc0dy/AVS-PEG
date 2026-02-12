import { Car } from "@/lib/car/car";
import { Intersection } from "@/utils/math";
import { Edge } from "@/lib/primitives/edge";
import { BufferGeometry, Float32BufferAttribute, Group, Line, LineBasicMaterial } from "three";
import { EdgeJson } from "@/types/save";

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
  /** Toggle car detection */
  ignoreTraffic: boolean = false;

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
   * Update sensor state with readings computed by the worker thread.
   *
   * This method receives pre-computed ray segments and intersection readings
   * from the car worker, avoiding expensive intersection tests on the main thread.
   *
   * @param rays - Ray segments computed by the worker
   * @param readings - Intersection readings for each ray (null if no hit)
   */
  update(rays: EdgeJson[], readings: (Intersection | null)[]) {
    this.rays = rays.map((rayJson) => {
      return Edge.fromJson(rayJson);
    });
    this.readings = readings;
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

      let line = this.sensorGroup.children[i] as Line<
        BufferGeometry,
        LineBasicMaterial
      >;

      if (line) {
        // Update existing line
        line.geometry.setAttribute(
          "position",
          new Float32BufferAttribute(points, 3),
        );
        line.material.color.set(this.readings[i] ? 0xff0000 : 0xffff00);
        line.geometry.computeBoundingSphere(); // Important for frustum culling
      } else {
        // Create new line if it doesn't exist
        const geometry = new BufferGeometry();
        geometry.setAttribute(
          "position",
          new Float32BufferAttribute(points, 3),
        );
        const material = new LineBasicMaterial({
          color: this.readings[i] ? 0xff0000 : 0xffff00,
          linewidth: 2,
        });
        line = new Line(geometry, material);
        this.sensorGroup.add(line);
      }
    }

    // Remove any excess lines if rayCount was reduced
    while (this.sensorGroup.children.length > this.rayCount) {
      const line = this.sensorGroup.children.pop() as Line;
      line.geometry.dispose();
      (line.material as LineBasicMaterial).dispose();
    }
  }

  /**
   * Dispose sensor debug meshes/materials and detach from the scene.
   */
  dispose() {
    this.sensorGroup.children.forEach((child) => {
      const line = child as Line;
      if (line.geometry) {
        line.geometry.dispose();
      }
      if (line.material) {
        (line.material as LineBasicMaterial).dispose();
      }
    });
    this.sensorGroup.clear();
    if (this.sensorGroup.parent) {
      this.sensorGroup.parent.remove(this.sensorGroup);
    }
  }
}
