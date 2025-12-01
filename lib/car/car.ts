import {
  Material,
  Mesh,
  Vector2,
  Group,
  Object3D,
  Color,
  BoxGeometry,
  MeshBasicMaterial,
} from "three";
import { Sensor } from "@/lib/car/sensor";
import { Controls, ControlType } from "@/lib/car/controls";
import { Polygon } from "@/lib/primitives/polygon";
import { Node } from "../primitives/node";
import { doPolygonsIntersect } from "@/utils/math";
import { GLTFLoader } from "three/examples/jsm/Addons.js";

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
 * Coordinate convention: `position` is a `Vector2` (x, y) where `y` maps
 * to Three.js Z when rendering.
 */
export class Car {
  /** Position in world units. `y` maps to Three.js Z when rendering. */
  position: Vector2;
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

  constructor(
    position: Vector2,
    breadth: number,
    length: number,
    height: number,
    controlType: ControlType,
    group: Group,
    angle = 0,
    maxSpeed = 0.5
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
  }

  update(traffic: Car[]) {
    this.draw(this.group, this.modelUrl);
    if (!this.damaged) {
      this.move();
      this.polygon = this.createPolygon();
      this.damaged = this.assessDamage(traffic);
    }
    if (this.sensor) {
      this.sensor.update(traffic);
      this.sensor.readings.map((s) => (s == null ? 0 : 1 - s.offset));
    }
  }

  /**
   * Check for collisions between this car and other vehicles.
   *
   * Iterates over the provided `traffic` array and returns `true` if the
   * current car's collision polygon intersects any other's polygon.
   */
  private assessDamage(traffic: Car[]): boolean {
    if (this.polygon === null) return false;

    for (let i = 0; i < traffic.length; i++) {
      if (traffic[i].polygon === null) continue;
      if (doPolygonsIntersect(this.polygon, traffic[i].polygon!)) {
        return true;
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
        this.position.x - Math.sin(this.angle - alpha) * rad,
        this.position.y - Math.cos(this.angle - alpha) * rad
      )
    );
    points.push(
      new Node(
        this.position.x - Math.sin(this.angle + alpha) * rad,
        this.position.y - Math.cos(this.angle + alpha) * rad
      )
    );
    points.push(
      new Node(
        this.position.x - Math.sin(Math.PI + this.angle - alpha) * rad,
        this.position.y - Math.cos(Math.PI + this.angle - alpha) * rad
      )
    );
    points.push(
      new Node(
        this.position.x - Math.sin(Math.PI + this.angle + alpha) * rad,
        this.position.y - Math.cos(Math.PI + this.angle + alpha) * rad
      )
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
      if (this.controls.left) {
        this.angle += 0.03 * flip;
      }
      if (this.controls.right) {
        this.angle -= 0.03 * flip;
      }
    }

    this.position.x -= Math.sin(this.angle) * this.speed;
    this.position.y -= Math.cos(this.angle) * this.speed;
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
          this.model.rotation.set(0, this.angle, 0);
          target.add(this.model);
        },
        undefined,
        () => {
          this.loadingModel = false;
        }
      );

      return;
    }

    this.model.position.set(this.position.x, 0, this.position.y);
    this.model.rotation.set(0, this.angle, 0);
    if (!target.children.includes(this.model)) {
      target.add(this.model);
    }

    if (!this.carColliderMesh) {
      const carGeometry = new BoxGeometry(
        this.breadth,
        this.height,
        this.length
      );
      const carMaterial = new MeshBasicMaterial({
        color: new Color(0x00ff00),
        transparent: true,
        opacity: 0.1,
      });
      const carMesh = new Mesh(carGeometry, carMaterial);
      this.carColliderMesh = carMesh;
    }
    this.carColliderMesh.position.set(
      this.position.x,
      this.height / 2,
      this.position.y
    );
    this.carColliderMesh.rotation.set(0, this.angle, 0);

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
    if (!this.model) return;
    if (this.model.parent) {
      this.model.parent.remove(this.model);
    }
    this.model.traverse((child: Object3D) => {
      if (child instanceof Mesh) {
        child.geometry.dispose();
        const material = child.material as Material | Material[];
        if (Array.isArray(material)) {
          material.forEach((mat) => mat.dispose());
        } else {
          material.dispose();
        }
      }
    });
    this.model = null;
    this.loadingModel = false;

    if (this.carColliderMesh) {
      this.carColliderMesh.geometry.dispose();
      this.carColliderMesh.material.dispose();
      this.carColliderMesh = null;
    }
  }
}
