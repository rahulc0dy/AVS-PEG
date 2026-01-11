import {
  Material,
  Mesh,
  Vector2,
  Group,
  Object3D,
  Color,
  BoxGeometry,
  MeshBasicMaterial,
  RingGeometry,
  DoubleSide,
} from "three";
import { Sensor } from "@/lib/car/sensor";
import { Controls, ControlType } from "@/lib/car/controls";
import { Polygon } from "@/lib/primitives/polygon";
import { Node } from "../primitives/node";
import { Edge } from "@/lib/primitives/edge";
import { GLTFLoader } from "three/examples/jsm/Addons.js";
import type {
  CarInitDto,
  CarSnapshotDto,
  CarStateDto,
  CarWorkerOutboundMessage,
  RoadRelativeDto,
  DestinationRelativeDto,
  TrafficCarDto,
  WallEdgeDto,
  PathEdgeDto,
} from "@/lib/car/worker-protocol";
import type { NeuralNetworkJson } from "@/lib/ai/network";

/** Options for creating a car with AI training support */
export interface CarOptions {
  /** Pre-trained brain to load (if not provided, creates a random brain) */
  brainJson?: NeuralNetworkJson;
  /** Mutation amount to apply to the brain (0 = no change, 1 = fully random) */
  mutationAmount?: number;
  /** Destination position for fitness calculation */
  destinationPosition?: Vector2;
  /** Path edges from source to destination for progress tracking */
  pathEdges?: PathEdgeDto[];
  /** Total length of the path */
  totalPathLength?: number;
}

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

  /** Current fitness score (higher = better performance toward destination) */
  fitness: number = 0;
  /** Whether the car has reached the destination */
  reachedDestination: boolean = false;

  private readonly controlType: ControlType;

  /** URL used to lazily load the GLTF model for this car. */
  private modelUrl: string = "/models/car.gltf";
  /** Root group returned by the GLTF loader (null until loaded). */
  private model: Group | null = null;
  /** Simple guard to prevent concurrent model loads. */
  private loadingModel = false;

  /** Mesh used to visualize the car collider (optional, created lazily). */
  private carColliderMesh: Mesh<BoxGeometry, MeshBasicMaterial> | null = null;

  /** Mesh used to highlight this car when it's selected as "best" during training. */
  private bestHighlightRing: Mesh<RingGeometry, MeshBasicMaterial> | null =
    null;

  /**
   * Original material colors cached so we can restore after highlight is disabled.
   * We use WeakMap so materials are not strongly retained after model disposal.
   */
  private originalMaterialColors: WeakMap<
    Material,
    { color?: Color; emissive?: Color }
  > = new WeakMap();

  /** Parent Three.js group where this car attaches its meshes. */
  private group: Group;

  private worker: Worker | null = null;
  private workerReady = false;

  /** Monotonically increasing snapshot sequence number sent to the worker. */
  private snapshotSeq = 0;

  /** When true, car-to-car overlap does not mark this car as damaged (used when stack-spawning). */
  ignoreCarDamage: boolean = false;

  /** Options passed during construction for AI training */
  private carOptions?: CarOptions;

  /** Promise resolvers for getBrain requests */
  private brainResolvers: Array<(brain: NeuralNetworkJson | null) => void> = [];

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
   * @param options Optional car options for AI training.
   */
  constructor(
    position: Vector2,
    breadth: number,
    length: number,
    height: number,
    controlType: ControlType,
    group: Group,
    angle = 0,
    maxSpeed = 0.5,
    options?: CarOptions,
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
    this.carOptions = options;

    this.initWorker();
  }

  /**
   * Request the brain data from this car's worker.
   * Returns a promise that resolves with the brain JSON or null if not available.
   */
  getBrain(): Promise<NeuralNetworkJson | null> {
    return new Promise((resolve) => {
      if (!this.worker || !this.workerReady) {
        resolve(null);
        return;
      }
      this.brainResolvers.push(resolve);
      this.worker.postMessage({ type: "getBrain" });
    });
  }

  update(
    traffic: Car[],
    roadEdges?: Edge[],
    roadWidth?: number,
    walls?: Edge[],
    highlightBest: boolean = false,
  ) {
    this.draw(this.group, this.modelUrl, undefined, { highlightBest });

    const roadRelative = this.computeRoadRelativeFeatures(roadEdges, roadWidth);
    const destinationRelative = this.computeDestinationRelativeFeatures();

    const trafficForWorker = this.sensor?.ignoreTraffic ? [] : traffic;

    // Publish latest environment snapshot. The worker owns simulation time.
    this.sendWorkerSnapshot({
      seq: ++this.snapshotSeq,
      traffic: trafficForWorker.map((c) => c.toTrafficCarDto()),
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
      destinationRelative,
      walls: walls?.map<WallEdgeDto>((e) => ({
        n1: { x: e.n1.x, y: e.n1.y },
        n2: { x: e.n2.x, y: e.n2.y },
      })),
    });
  }

  /**
   * Compute destination-relative features for AI navigation.
   * Returns angle difference and normalized distance to destination.
   */
  private computeDestinationRelativeFeatures(): DestinationRelativeDto {
    const destPos = this.carOptions?.destinationPosition;
    if (!destPos) {
      return { angleDiff: 0, distance: 1 };
    }

    // Vector from car to destination
    const dx = destPos.x - this.position.x;
    const dy = destPos.y - this.position.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Angle to destination in world coordinates
    // Car movement uses: x -= sin(angle) * speed, y -= cos(angle) * speed
    // So car faces direction: (-sin(angle), -cos(angle))
    // Angle to destination: atan2(-dx, -dy) to match car coordinate system
    const angleToDestination = Math.atan2(-dx, -dy);

    // Difference between car heading and direction to destination
    // Normalize to [-PI, PI]
    let angleDiff = angleToDestination - this.angle;
    while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
    while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;

    // Normalize angle diff to [-1, 1] where:
    // -1 = need to turn left (destination on left)
    //  0 = destination straight ahead
    //  1 = need to turn right (destination on right)
    const normalizedAngleDiff = angleDiff / Math.PI;

    // Normalize distance using sigmoid-like function
    // This gives smooth gradient: close = 0, far = approaching 1
    const referenceDistance = 500; // Reference distance for normalization
    const normalizedDistance = distance / (distance + referenceDistance);

    return {
      angleDiff: normalizedAngleDiff,
      distance: normalizedDistance,
    };
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
            // Start autonomous simulation loop.
            this.worker?.postMessage({ type: "start" });
          }
          return;

        case "state":
          if (msg.state.id === this.id) {
            this.applyWorkerState(msg.state);
          }
          return;

        case "brain":
          if (msg.id === this.id) {
            // Resolve all pending brain requests
            const resolvers = this.brainResolvers;
            this.brainResolvers = [];
            for (const resolve of resolvers) {
              resolve(msg.brainJson);
            }
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
      brainJson: this.carOptions?.brainJson,
      mutationAmount: this.carOptions?.mutationAmount,
      destinationPosition: this.carOptions?.destinationPosition
        ? {
            x: this.carOptions.destinationPosition.x,
            y: this.carOptions.destinationPosition.y,
          }
        : undefined,
      pathEdges: this.carOptions?.pathEdges,
      totalPathLength: this.carOptions?.totalPathLength,
    };

    this.worker.postMessage({ type: "init", init });
  }

  private sendWorkerSnapshot(snapshot: CarSnapshotDto) {
    if (!this.worker || !this.workerReady) return;
    this.worker.postMessage({ type: "snapshot", snapshot });
  }

  private applyWorkerState(state: CarStateDto) {
    this.position.set(state.position.x, state.position.y);
    this.angle = state.angle;
    this.speed = state.speed;
    this.damaged = state.damaged;
    this.fitness = state.fitness;
    this.reachedDestination = state.reachedDestination;

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
      ignoreCarDamage: this.ignoreCarDamage,
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
   * @param options Rendering options (e.g., highlight the best car)
   */
  draw(
    target: Group,
    url: string,
    loader?: GLTFLoader,
    options?: { highlightBest?: boolean },
  ) {
    const highlightBest = options?.highlightBest ?? false;

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

          // Make sure the highlight visuals match immediately after load.
          this.applyBestHighlight(highlightBest);
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

    this.applyBestHighlight(highlightBest);

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
    this.carColliderMesh.rotation.set(0, this.angle, 0);

    if (!target.children.includes(this.carColliderMesh)) {
      target.add(this.carColliderMesh);
    }
  }

  /**
   * Toggle the "best car" highlight visuals.
   * This is designed to be cheap on every frame (no material cloning).
   */
  private applyBestHighlight(enabled: boolean) {
    // Ring indicator under the car.
    if (enabled) {
      if (!this.bestHighlightRing) {
        const geometry = new RingGeometry(8, 11, 48);
        const material = new MeshBasicMaterial({
          color: new Color(0xffd400),
          transparent: true,
          opacity: 0.9,
          side: DoubleSide,
          depthTest: false,
        });
        this.bestHighlightRing = new Mesh(geometry, material);
        // Lay flat on the ground.
        this.bestHighlightRing.rotation.set(-Math.PI / 2, 0, 0);
        // Slightly above the ground to avoid z-fighting.
        this.bestHighlightRing.position.set(
          this.position.x,
          0.05,
          this.position.y,
        );
      }

      this.bestHighlightRing.position.set(
        this.position.x,
        0.05,
        this.position.y,
      );
      if (this.bestHighlightRing.parent !== this.group) {
        this.group.add(this.bestHighlightRing);
      }
    } else if (this.bestHighlightRing) {
      if (this.bestHighlightRing.parent) {
        this.bestHighlightRing.parent.remove(this.bestHighlightRing);
      }
    }

    // Emissive/material tint on the model (if it has materials).
    if (!this.model) return;

    const highlightColor = new Color(0xffd400);

    this.model.traverse((child: Object3D) => {
      // Some Object3D instances are not Mesh; rely on presence of `material`.
      const anyChild = child as unknown as { material?: unknown };
      if (!anyChild.material) return;

      const mesh = child as unknown as Mesh;

      const materials = Array.isArray(mesh.material)
        ? (mesh.material as Material[])
        : ([mesh.material] as Material[]);

      for (const mat of materials) {
        // Cache original colors the first time we see this material.
        if (!this.originalMaterialColors.has(mat)) {
          const anyMat = mat as unknown as { color?: Color; emissive?: Color };
          this.originalMaterialColors.set(mat, {
            color: anyMat.color ? anyMat.color.clone() : undefined,
            emissive: anyMat.emissive ? anyMat.emissive.clone() : undefined,
          });
        }

        const anyMat = mat as unknown as {
          color?: Color;
          emissive?: Color;
          emissiveIntensity?: number;
        };

        if (enabled) {
          if (anyMat.emissive) {
            anyMat.emissive.copy(highlightColor);
            anyMat.emissiveIntensity = 1.5;
          } else if (anyMat.color) {
            // Fallback for non-standard materials: brighten base color.
            anyMat.color.lerp(highlightColor, 0.5);
          }
        } else {
          const original = this.originalMaterialColors.get(mat);
          if (original?.emissive && anyMat.emissive) {
            anyMat.emissive.copy(original.emissive);
            anyMat.emissiveIntensity = 1;
          }
          if (original?.color && anyMat.color) {
            anyMat.color.copy(original.color);
          }
        }
      }
    });
  }

  /**
   * Dispose Three.js resources used by this car and remove visuals from the
   * scene. This frees geometries and materials owned by the car's model and
   * collider mesh.
   */
  dispose() {
    if (this.worker) {
      // Stop loop first (best-effort), then terminate.
      try {
        this.worker.postMessage({ type: "stop" });
      } catch {
        // ignore
      }
      this.worker.terminate();
      this.worker = null;
    }

    // Dispose sensor
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

    if (this.bestHighlightRing) {
      if (this.bestHighlightRing.parent) {
        this.bestHighlightRing.parent.remove(this.bestHighlightRing);
      }
      this.bestHighlightRing.geometry.dispose();
      this.bestHighlightRing.material.dispose();
      this.bestHighlightRing = null;
    }
  }
}
