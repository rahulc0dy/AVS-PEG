import { BoxGeometry, Color, Group, Material, Mesh, MeshBasicMaterial, Object3D } from "three";
import { Sensor } from "@/lib/car/sensor";
import { Controls, ControlType } from "@/lib/car/controls";
import {
  CarControlSnapshot,
  CarKinematicsState,
  CarKinematicsStepResult,
  CarWorkerIncomingMessage,
  CarWorkerOutgoingMessage,
  CarWorkerStepResult,
} from "@/lib/car/car-worker-types";
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
 * - Advance simulation each frame (`update`), optionally delegating
 *   kinematics to a per-car worker
 * - Provide a collision polygon used for intersection tests
 * - Lazily load and render a 3D model and an optional collider mesh
 *
 * Coordinate convention: `position` is a `Node` (x, y) where `y` maps
 * to Three.js Z when rendering. Heading `angle` is measured from +X with
 * counter-clockwise rotation (standard math coordinates).
 */
export class Car {
  /** Unique identifier for this car. */
  id: number;
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

  /** Dedicated worker assigned to this car (null if unsupported). */
  private worker: Worker | null = null;
  /** True once the worker acknowledges initialization. */
  private workerReady = false;
  /** Indicates an in-flight step request to the worker. */
  private workerBusy = false;
  /** Latest step computed on the worker, awaiting application on the main thread. */
  private pendingWorkerStep: CarWorkerStepResult | null = null;

  /** URL used to lazily load the GLTF model for this car. */
  private modelUrl: string = "/models/car.gltf";
  /** Root group returned by the GLTF loader (null until loaded). */
  private model: Group | null = null;
  /** Simple guard to prevent concurrent model loads. */
  private loadingModel = false;

  /** Mesh used to visualize the car collider (optional, created lazily). */
  private carColliderMesh: Mesh<BoxGeometry, MeshBasicMaterial> | null = null;

  /** Parent Three.js group where this car attaches its meshes. */
  private readonly group: Group;

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
    id: number,
    position: Node,
    breadth: number,
    length: number,
    height: number,
    controlType: ControlType,
    group: Group,
    angle = 0,
    maxSpeed = 0.5,
  ) {
    this.id = id;
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
   * collision polygon (via worker result or local fallback), performs
   * collision checks against `traffic`, and updates sensors if present.
   * @param traffic Other cars to consider for collision/sensor readings.
   * @param pathBorders
   */
  update(traffic: Car[], pathBorders: Edge[]) {
    const appliedWorkerState = this.applyPendingWorkerStep();

    if (!this.damaged && !appliedWorkerState) {
      this.applyKinematicsResult(this.stepLocally());
    }

    if (!this.damaged && this.polygon) {
      this.damaged = this.assessDamage(traffic, pathBorders);
    }

    if (this.sensor) {
      this.sensor.update(traffic, pathBorders);
      this.sensor.readings.map((s) => (s == null ? 0 : 1 - s.offset));
    }

    this.draw(this.group, this.modelUrl);
    this.requestWorkerStep();
  }

  ignoreDamageFromCars() {
    this.ignoreCarDamage = true;
    if (this.sensor) {
      this.sensor.ignoreTraffic = true;
    }
  }

  /**
   * Snapshot the current kinematic state in a form suitable for worker
   * transfer. Rendering-only fields are intentionally excluded.
   */
  private getKinematicsState(): CarKinematicsState {
    return {
      id: this.id,
      position: { x: this.position.x, y: this.position.y },
      angle: this.angle,
      speed: this.speed,
      acceleration: this.acceleration,
      maxSpeed: this.maxSpeed,
      friction: this.friction,
      breadth: this.breadth,
      length: this.length,
    };
  }

  /**
   * Convert control flags into a plain object that can be posted to a worker.
   */
  private getControlSnapshot(): CarControlSnapshot {
    return {
      forward: this.controls.forward,
      reverse: this.controls.reverse,
      left: this.controls.left,
      right: this.controls.right,
    };
  }

  /**
   * Main-thread fallback for advancing kinematics when a worker is not ready.
   */
  private stepLocally(): CarKinematicsStepResult {
    const state = this.getKinematicsState();
    const controls = this.getControlSnapshot();

    let speed = state.speed;
    let angle = state.angle;

    if (controls.forward) speed += state.acceleration;
    if (controls.reverse) speed -= state.acceleration;

    if (speed > state.maxSpeed) speed = state.maxSpeed;
    if (speed < -state.maxSpeed / 2) speed = -state.maxSpeed / 2;

    if (speed > 0) speed -= state.friction;
    if (speed < 0) speed += state.friction;
    if (Math.abs(speed) < state.friction) speed = 0;

    if (speed !== 0) {
      const flip = speed > 0 ? 1 : -1;
      if (controls.left) angle -= 0.03 * flip;
      if (controls.right) angle += 0.03 * flip;
    }

    const position = {
      x: state.position.x + Math.cos(angle) * speed,
      y: state.position.y + Math.sin(angle) * speed,
    };

    return {
      state: {
        ...state,
        position,
        angle,
        speed,
      },
      polygonPoints: this.createFootprintPoints(
        position,
        angle,
        state.breadth,
        state.length,
      ),
    };
  }

  /**
   * Apply a worker (or local) kinematic step onto this car, updating position,
   * orientation, speed and the collision polygon.
   */
  private applyKinematicsResult(result: CarKinematicsStepResult) {
    this.position.x = result.state.position.x;
    this.position.y = result.state.position.y;
    this.angle = result.state.angle;
    this.speed = result.state.speed;

    this.polygon = new Polygon(
      result.polygonPoints.map((p) => new Node(p.x, p.y)),
    );
  }

  /**
   * Build the rectangular footprint polygon for a car given its centre
   * position, heading, width and length.
   */
  private createFootprintPoints(
    position: { x: number; y: number },
    angle: number,
    breadth: number,
    length: number,
  ) {
    const points: { x: number; y: number }[] = [];
    const radius = Math.hypot(breadth, length) / 2;
    const alpha = Math.atan2(breadth, length);

    points.push({
      x: position.x + Math.cos(angle - alpha) * radius,
      y: position.y + Math.sin(angle - alpha) * radius,
    });
    points.push({
      x: position.x + Math.cos(angle + alpha) * radius,
      y: position.y + Math.sin(angle + alpha) * radius,
    });
    points.push({
      x: position.x + Math.cos(Math.PI + angle - alpha) * radius,
      y: position.y + Math.sin(Math.PI + angle - alpha) * radius,
    });
    points.push({
      x: position.x + Math.cos(Math.PI + angle + alpha) * radius,
      y: position.y + Math.sin(Math.PI + angle + alpha) * radius,
    });

    return points;
  }

  /**
   * Consume the latest worker step if one is queued. Returns true when a
   * worker-produced result was applied this frame.
   */
  private applyPendingWorkerStep(): boolean {
    if (this.damaged || !this.pendingWorkerStep) {
      return false;
    }

    this.applyKinematicsResult(this.pendingWorkerStep);
    this.pendingWorkerStep = null;
    return true;
  }

  /**
   * Post an asynchronous step request to the worker. If workers are not
   * available, the car continues to run entirely on the main thread.
   */
  private requestWorkerStep() {
    if (
      !this.worker ||
      !this.workerReady ||
      this.workerBusy ||
      this.damaged
    ) {
      return;
    }

    const message: CarWorkerIncomingMessage = {
      type: "step",
      payload: {
        state: this.getKinematicsState(),
        controls: this.getControlSnapshot(),
      },
    };

    this.workerBusy = true;
    this.worker.postMessage(message);
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
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
      this.workerReady = false;
      this.workerBusy = false;
      this.pendingWorkerStep = null;
    }

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
   * Create and wire a dedicated Web Worker for this car. When workers are not
   * available (SSR or older browsers), the car continues to simulate on the
   * main thread.
   */
  private initWorker() {
    if (typeof window === "undefined" || !window.Worker) return;

    this.worker = new Worker(new URL("./car.worker.ts", import.meta.url), {
      type: "module",
    });

    this.worker.onmessage = (
      event: MessageEvent<CarWorkerOutgoingMessage>,
    ) => {
      const message = event.data;
      if (message.type === "ready" && message.payload.id === this.id) {
        this.workerReady = true;
        this.workerBusy = false;
        return;
      }

      if (message.type === "step" && message.payload.id === this.id) {
        this.workerBusy = false;
        this.pendingWorkerStep = message.payload;
      }
    };

    this.worker.onerror = () => {
      this.workerReady = false;
      this.workerBusy = false;
    };

    const initMessage: CarWorkerIncomingMessage = {
      type: "init",
      payload: {
        id: this.id,
        state: this.getKinematicsState(),
      },
    };
    this.worker.postMessage(initMessage);
  }
}
