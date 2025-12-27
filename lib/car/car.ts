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
import { Edge } from "@/lib/primitives/edge";
import { GLTFLoader } from "three/examples/jsm/Addons.js";
import type {
  CarInitDto,
  CarStateDto,
  CarTickDto,
  CarWorkerOutboundMessage,
  RoadRelativeDto,
  TrafficCarDto,
} from "@/lib/car/worker-protocol";

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
  private static nextId = 1;
  readonly id: string;

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

  private readonly controlType: ControlType;

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

  private worker: Worker | null = null;
  private workerReady = false;
  private tickInFlight = false;
  private queuedTick: CarTickDto | null = null;

  constructor(
    position: Vector2,
    breadth: number,
    length: number,
    height: number,
    controlType: ControlType,
    group: Group,
    angle = 0,
    maxSpeed = 0.5,
  ) {
    this.id = `car-${Car.nextId++}`;
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

    this.sensor = new Sensor(this);

    this.controlType = controlType;
    this.controls = new Controls(controlType);
    this.group = group;

    this.initWorker();
  }

  update(traffic: Car[], roadEdges?: Edge[], roadWidth?: number) {
    this.draw(this.group, this.modelUrl);

    const roadRelative = this.computeRoadRelativeFeatures(roadEdges, roadWidth);

    // All simulation is done in this car's dedicated worker.
    this.requestWorkerTick({
      traffic: traffic.map((c) => c.toTrafficCarDto()),
      controls:
        this.controlType === ControlType.HUMAN
          ? {
              forward: this.controls.forward,
              left: this.controls.left,
              right: this.controls.right,
              reverse: this.controls.reverse,
            }
          : undefined,
      roadRelative,
    });
  }

  private computeRoadRelativeFeatures(
    roadEdges?: Edge[],
    roadWidth?: number,
  ): RoadRelativeDto {
    if (!roadEdges || roadEdges.length === 0) {
      return { lateral: 0, along: 0 };
    }

    const halfWidth = (roadWidth ?? 0) / 2;
    const px = this.position.x;
    const py = this.position.y;

    let bestDist = Infinity;
    let bestLateral = 0;
    let bestAlong = 0;

    for (const edge of roadEdges) {
      const x1 = edge.n1.x;
      const y1 = edge.n1.y;
      const x2 = edge.n2.x;
      const y2 = edge.n2.y;

      const dx = x2 - x1;
      const dy = y2 - y1;
      const len2 = dx * dx + dy * dy;
      if (len2 <= 0) continue;

      // Project point onto segment (clamped).
      const t = ((px - x1) * dx + (py - y1) * dy) / len2;
      const tClamped = Math.max(0, Math.min(1, t));
      const projX = x1 + tClamped * dx;
      const projY = y1 + tClamped * dy;

      const vx = px - projX;
      const vy = py - projY;
      const dist = Math.hypot(vx, vy);

      if (dist >= bestDist) continue;

      // Signed lateral offset using 2D cross product sign.
      const len = Math.sqrt(len2);
      const dirX = dx / len;
      const dirY = dy / len;
      const cross = dirX * vy - dirY * vx;
      const sign = cross === 0 ? 0 : cross > 0 ? 1 : -1;
      const lateralSigned = dist * sign;

      // Normalize features.
      const lateralNorm =
        halfWidth > 0
          ? Math.max(-1, Math.min(1, lateralSigned / halfWidth))
          : 0;
      const alongNorm = tClamped * 2 - 1; // [-1..1]

      bestDist = dist;
      bestLateral = lateralNorm;
      bestAlong = alongNorm;
    }

    return { lateral: bestLateral, along: bestAlong };
  }

  private initWorker() {
    // Workers only exist in the browser.
    if (typeof window === "undefined") return;
    if (typeof Worker === "undefined") return;

    this.worker = new Worker(new URL("./car.worker.ts", import.meta.url), {
      type: "module",
    });

    this.worker.onmessage = (evt: MessageEvent<CarWorkerOutboundMessage>) => {
      const msg = evt.data;
      switch (msg.type) {
        case "ready":
          if (msg.id === this.id) {
            this.workerReady = true;
          }
          return;

        case "state":
          if (msg.state.id === this.id) {
            this.applyWorkerState(msg.state);
          }
          this.tickInFlight = false;
          if (this.queuedTick) {
            const queued = this.queuedTick;
            this.queuedTick = null;
            this.requestWorkerTick(queued);
          }
          return;
      }
    };

    const init: CarInitDto = {
      id: this.id,
      position: { x: this.position.x, y: this.position.y },
      breadth: this.breadth,
      length: this.length,
      height: this.height,
      angle: this.angle,
      maxSpeed: this.maxSpeed,
      controlType: this.controlType,
      acceleration: this.acceleration,
      friction: this.friction,
      rayCount: this.sensor?.rayCount ?? 0,
      rayLength: this.sensor?.rayLength ?? 0,
      raySpreadAngle: this.sensor?.raySpreadAngle ?? 0,
    };

    this.worker.postMessage({ type: "init", init });
  }

  private requestWorkerTick(tick: CarTickDto) {
    if (!this.worker) return;
    if (!this.workerReady) {
      // Queue until the worker is ready so we don't drop early frames.
      this.queuedTick = tick;
      return;
    }

    if (this.tickInFlight) {
      this.queuedTick = tick;
      return;
    }

    this.tickInFlight = true;
    this.worker.postMessage({ type: "tick", tick });
  }

  private applyWorkerState(state: CarStateDto) {
    this.position.set(state.position.x, state.position.y);
    this.angle = state.angle;
    this.speed = state.speed;
    this.damaged = state.damaged;

    // Keep a main-thread copy for traffic snapshots and any debug visuals.
    this.polygon = new Polygon(state.polygon.map((p) => new Node(p.x, p.y)));

    if (this.sensor) {
      this.sensor.rayCount = state.sensor.rays.length;
      this.sensor.rays = state.sensor.rays.map(
        (r) =>
          new Edge(new Node(r.start.x, r.start.y), new Node(r.end.x, r.end.y)),
      );
      this.sensor.readings = state.sensor.readings.map((reading) =>
        reading ? { x: reading.x, y: reading.y, offset: reading.offset } : null,
      );
    }
  }

  private toTrafficCarDto(): TrafficCarDto {
    return {
      id: this.id,
      polygon: this.polygon?.nodes.map((n) => ({ x: n.x, y: n.y })) ?? [],
    };
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
        },
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
        this.length,
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
      this.position.y,
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
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }

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
