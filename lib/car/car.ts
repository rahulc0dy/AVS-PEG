import { BoxGeometry, Color, Group, Material, Mesh, MeshBasicMaterial, Object3D } from "three";
import { Sensor } from "@/lib/car/sensor";
import { Controls, ControlType } from "@/lib/car/controls";
import { Polygon } from "@/lib/primitives/polygon";
import { Node } from "../primitives/node";
import { doPolygonsIntersect, getIntersection } from "@/utils/math";
import { GLTFLoader } from "three/examples/jsm/Addons.js";
import { Edge } from "@/lib/primitives/edge";

/**
 * Simulated vehicle with simple physics, optional sensors and a lazily
 * loaded GLTF visual model.
 *
 * Responsibilities:
 * - Maintain logical state (position, heading, speed)
 * - Advance simulation each frame (`update` / `move`)
 * - Provide a collision polygon used for intersection tests
 * - Lazily load and render a 3D model and an optional collider mesh
 *
 * Coordinate convention: `position` is a `Node` (x, y) where `y` maps
 * to Three.js Z when rendering. Heading `angle` is measured from +X with
 * counter-clockwise rotation (standard math coordinates).
 */
export class Car {
  /** Position in world units. `y` maps to Three.js Z when rendering. */
  position: Node;
  /** Vehicle width along the X axis. */
  breadth: number;
  /** Vehicle length along the Z axis. */
  length: number;
  /** Vehicle height along the Y axis. */
  height: number;
  /** Current forward (+) / reverse (-) speed. */
  speed: number;
  /** Per-frame acceleration applied when accelerating or reversing. */
  acceleration: number;
  /** Maximum forward speed. */
  maxSpeed: number;
  /** Friction applied each frame to reduce speed. */
  friction: number;
  /** Heading angle in radians. */
  angle: number;
  /** Whether the car has been damaged (collision detected). */
  damaged: boolean;
  /** Optional sensor array attached to the car (null if none). */
  sensor: Sensor | null = null;
  /** Input state (keyboard or AI) controlling this car. */
  controls: Controls;
  /** Cached collision polygon used for intersection checks. Rebuilt each update. */
  polygon: Polygon | null = null;
  /** If enabled, car to car damages are ignored */
  ignoreCarDamage: boolean = false;

  private worker: Worker | null = null;

  /** URL used to lazily load the GLTF model for this car. */
  private modelUrl: string = "/models/car.gltf";
  /** Root group returned by the GLTF loader (null until loaded). */
  private model: Group | null = null;
  /** Simple guard to prevent concurrent model loads. */
  private loadingModel = false;

  /** Mesh used to visualize the car collider (optional, created lazily). */
  private carColliderMesh: Mesh<BoxGeometry, MeshBasicMaterial> | null = null;

  /** Parent Three.js group where this car attaches its meshes. */
  private group: Group;

  /**
   * Create a new simulated car.
   * @param position Initial world position (x, y; where y maps to Three.js Z).
   * @param breadth Vehicle width along X.
   * @param length Vehicle length along Z.
   * @param height Vehicle height along Y.
   * @param controlType Input scheme (human/ai/none).
   * @param group Parent group that will receive the car's meshes.
   * @param angle Initial heading in radians.
   * @param maxSpeed Maximum forward speed.
   */
  constructor(
    position: Node,
    breadth: number,
    length: number,
    height: number,
    controlType: ControlType,
    group: Group,
    angle = 0,
    maxSpeed = 0.5,
  ) {
    this.position = position;
    this.breadth = breadth;
    this.length = length;
    this.height = height;

    this.speed = 0;
    this.acceleration = 0.2;
    this.maxSpeed = maxSpeed;
    this.friction = 0.05;
    this.angle = angle;
    this.damaged = false;

    if (controlType != ControlType.AI) {
      this.sensor = new Sensor(this);
    }
    this.controls = new Controls(controlType as ControlType);
    this.group = group;

    this.initWorker();
  }

  /**
   * Advance the simulation by one frame.
   *
   * This updates visuals, moves the car when not damaged, recomputes the
   * collision polygon, performs collision checks against `traffic`, and
   * updates sensors if present.
   * @param traffic Other cars to consider for collision/sensor readings.
   * @param pathBorders
   */
  update(traffic: Car[], pathBorders: Edge[]) {
    this.draw(this.group, this.modelUrl);
    if (!this.damaged) {
      this.move();
      this.polygon = this.createPolygon();
      this.damaged = this.assessDamage(traffic, pathBorders);
    }
    if (this.sensor) {
      this.sensor.update(traffic, pathBorders);
      this.sensor.readings.map((s) => (s == null ? 0 : 1 - s.offset));
    }
  }

  ignoreDamageFromCars() {
    this.ignoreCarDamage = true;
    if (this.sensor) {
      this.sensor.ignoreTraffic = true;
    }
  }

  /**
   * Render the car's sensors, 3D model and optional collider into `target`.
   * The GLTF model is loaded lazily; `loadingModel` prevents duplicate
   * concurrent loads.
   *
   * @param target Parent group where meshes are added
   * @param url GLTF model URL
   * @param loader Optional `GLTFLoader` to reuse
   */
  draw(target: Group, url: string, loader?: GLTFLoader) {
    if (this.sensor) {
      this.sensor.draw(target);
    }
    if (!this.model) {
      if (this.loadingModel) return;
      this.loadingModel = true;
      if (!loader) loader = new GLTFLoader();
      loader.load(
        url,
        (gltf) => {
          this.model = gltf.scene;
          this.loadingModel = false;
          this.model.scale.set(3, 3, 3);
          this.model.position.set(this.position.x, 0, this.position.y);
          // Three.js default forward is +Z; rotate so angle=0 faces +X.
          this.model.rotation.set(0, Math.PI / 2 - this.angle, 0);
          target.add(this.model);
        },
        undefined,
        () => {
          this.loadingModel = false;
        },
      );

      return;
    }

    this.model.position.set(this.position.x, 0, this.position.y);
    this.model.rotation.set(0, Math.PI / 2 - this.angle, 0);
    if (!target.children.includes(this.model)) {
      target.add(this.model);
    }

    if (!this.carColliderMesh) {
      const carGeometry = new BoxGeometry(
        this.breadth,
        this.height,
        this.length,
      );
      const carMaterial = new MeshBasicMaterial({
        color: new Color(0x00ff00),
        transparent: true,
        opacity: 0.1,
      });

      this.carColliderMesh = new Mesh(carGeometry, carMaterial);
    }
    this.carColliderMesh.position.set(
      this.position.x,
      this.height / 2,
      this.position.y,
    );
    this.carColliderMesh.rotation.set(0, Math.PI / 2 - this.angle, 0);

    if (!target.children.includes(this.carColliderMesh)) {
      target.add(this.carColliderMesh);
    }
  }

  /**
   * Dispose Three.js resources used by this car and remove visuals from the
   * scene. This frees geometries and materials owned by the car's model and
   * collider mesh.
   */
  dispose() {
    if (this.sensor) {
      this.sensor.dispose();
    }
    if (this.model) {
      // Remove from parent group
      if (this.model.parent) {
        this.model.parent.remove(this.model);
      }

      // Dispose meshes
      this.model.traverse((child: Object3D) => {
        const anyChild = child as unknown as {
          geometry?: { dispose?: () => void };
          material?: unknown;
        };
        if (!anyChild.geometry || !anyChild.material) return;

        const mesh = child as unknown as Mesh;
        mesh.geometry.dispose();
        const material = mesh.material as Material | Material[];
        if (Array.isArray(material)) {
          material.forEach((mat) => mat.dispose());
        } else {
          material.dispose();
        }
      });
      this.model = null;
    }
    this.loadingModel = false;

    if (this.carColliderMesh) {
      // Remove from parent
      if (this.carColliderMesh.parent) {
        this.carColliderMesh.parent.remove(this.carColliderMesh);
      }
      this.carColliderMesh.geometry.dispose();
      this.carColliderMesh.material.dispose();
      // Clear the mesh
      this.carColliderMesh.clear();
      this.carColliderMesh = null;
    }
  }

  /**
   * Check for collisions between this car and other vehicles.
   *
   * Iterates over the provided `traffic` array and returns `true` if the
   * current car's collision polygon intersects any other's polygon.
   */
  private assessDamage(traffic: Car[], pathBorders: Edge[]): boolean {
    if (this.polygon === null) return false;

    if (!this.ignoreCarDamage) {
      for (let i = 0; i < traffic.length; i++) {
        if (traffic[i].polygon === null) continue;
        if (doPolygonsIntersect(this.polygon, traffic[i].polygon!)) {
          return true;
        }
      }
    }

    for (const pathBorder of pathBorders) {
      for (const edge of this.polygon.edges) {
        if (getIntersection(pathBorder.n1, pathBorder.n2, edge.n1, edge.n2)) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Construct a collision polygon representing this car's footprint.
   *
   * The polygon is computed from the car's centre position, dimensions and
   * heading and returned as a `Polygon` suitable for intersection tests.
   */
  private createPolygon(): Polygon {
    const points = [];
    const rad = Math.hypot(this.breadth, this.length) / 2;
    const alpha = Math.atan2(this.breadth, this.length);
    points.push(
      new Node(
        this.position.x + Math.cos(this.angle - alpha) * rad,
        this.position.y + Math.sin(this.angle - alpha) * rad,
      ),
    );
    points.push(
      new Node(
        this.position.x + Math.cos(this.angle + alpha) * rad,
        this.position.y + Math.sin(this.angle + alpha) * rad,
      ),
    );
    points.push(
      new Node(
        this.position.x + Math.cos(Math.PI + this.angle - alpha) * rad,
        this.position.y + Math.sin(Math.PI + this.angle - alpha) * rad,
      ),
    );
    points.push(
      new Node(
        this.position.x + Math.cos(Math.PI + this.angle + alpha) * rad,
        this.position.y + Math.sin(Math.PI + this.angle + alpha) * rad,
      ),
    );
    return new Polygon(points);
  }

  /**
   * Apply a single timestep of vehicle dynamics.
   *
   * Applies acceleration/reverse inputs, clamps speed, applies friction,
   * handles turning (inverts when reversing) and updates position.
   */
  private move() {
    if (this.controls.forward) {
      this.speed += this.acceleration;
    }
    if (this.controls.reverse) {
      this.speed -= this.acceleration;
    }

    if (this.speed > this.maxSpeed) {
      this.speed = this.maxSpeed;
    }
    if (this.speed < -this.maxSpeed / 2) {
      this.speed = -this.maxSpeed / 2;
    }

    if (this.speed > 0) {
      this.speed -= this.friction;
    }
    if (this.speed < 0) {
      this.speed += this.friction;
    }

    if (Math.abs(this.speed) < this.friction) {
      this.speed = 0;
    }

    if (this.speed != 0) {
      const flip = this.speed > 0 ? 1 : -1;
      // In math, anti-clockwise is +ve angle, so we reverse the angle to handle it properly
      if (this.controls.left) {
        this.angle -= 0.03 * flip;
      }
      if (this.controls.right) {
        this.angle += 0.03 * flip;
      }
    }

    this.position.x += Math.cos(this.angle) * this.speed;
    this.position.y += Math.sin(this.angle) * this.speed;
  }

  private initWorker() {
    if (!window.Worker) return;

    this.worker = new Worker(new URL("./car.worker.ts", import.meta.url));
    this.worker.postMessage("hello");
  }
}
