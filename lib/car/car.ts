import {
  BoxGeometry,
  Color,
  Group,
  Material,
  Mesh,
  MeshBasicMaterial,
  Object3D,
} from "three";
import { Sensor } from "@/lib/car/sensor";
import { Controls, ControlType } from "@/lib/car/controls";
import { Polygon } from "@/lib/primitives/polygon";
import { Node } from "@/lib/primitives/node";
import { GLTFLoader } from "three/examples/jsm/Addons.js";
import { Edge } from "@/lib/primitives/edge";
import { CAR_ACCELERATION, CAR_MAX_SPEED } from "@/env";
import {
  CarInitPayload,
  CarWorkerOutboundMessage,
  MarkingWallJson,
  SetBrainPayload,
  UpdateBiasPayload,
  UpdateCollisionDataPayload,
  UpdateControlsPayload,
  UpdateWeightPayload,
  WorkerInboundMessageType,
  WorkerOutboundMessageType,
} from "@/types/car/message";
import { ControlInputs } from "@/types/car/shared";
import { NeuralNetworkStateJson } from "@/types/car/state";
import { NeuralNetworkJson } from "@/types/save";

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
  /** Default collider color (semi-transparent green). */
  private static readonly DEFAULT_COLLIDER_COLOR = new Color(0x00ff00);
  /** Highlight collider color (bright gold/yellow). */
  private static readonly HIGHLIGHT_COLLIDER_COLOR = new Color(0xffd700);
  /** Default collider opacity. */
  private static readonly DEFAULT_COLLIDER_OPACITY = 0.1;
  /** Highlight collider opacity (more visible). */
  private static readonly HIGHLIGHT_COLLIDER_OPACITY = 0.4;

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
  /** Latest neural network state snapshot received from the worker (or `null` if unavailable). */
  network: NeuralNetworkStateJson | null = null;
  /** Path borders specific to this car's path, if any. Used to constrain the car. */
  pathBorders: Edge[] | null = null;
  /** Web Worker handling physics, collisions, and neural network updates for this car. */
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
  private readonly group: Group;
  /** Whether this car is currently highlighted as the best car. */
  private _isHighlighted: boolean = false;

  /**
   * Create a new simulated car.
   * @param id
   * @param position Initial world position (x, y; where y maps to Three.js Z).
   * @param breadth Vehicle width along X.
   * @param length Vehicle length along Z.
   * @param height Vehicle height along Y.
   * @param controlType Input scheme (human/ai/none).
   * @param group Parent group that will receive the car's meshes.
   * @param angle Initial heading in radians.
   * @param ignoreCarDamage If enabled, car to car damages are ignored.
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
    ignoreCarDamage = false,
    maxSpeed = CAR_MAX_SPEED,
  ) {
    this.id = id;
    this.position = position;
    this.breadth = breadth;
    this.length = length;
    this.height = height;

    this.speed = 0;
    this.acceleration = CAR_ACCELERATION;
    // Increase variability: random multiplier between 0.6x and 1.4x of base maxSpeed
    this.maxSpeed = maxSpeed * (0.6 + Math.random() * 0.8);
    // Set friction slightly lower than acceleration so it visibly accelerates
    this.friction = CAR_ACCELERATION * 0.4;
    this.angle = angle;
    this.damaged = false;

    if (controlType != ControlType.NONE) {
      this.sensor = new Sensor(this);
    }
    this.controls = new Controls(controlType as ControlType);
    this.group = group;

    if (ignoreCarDamage) {
      this.ignoreDamageFromCars();
    }

    this.initWorker();
  }

  /**
   * Advance the simulation by one frame.
   *
   * This updates visuals, sends collision data to worker, and
   * updates sensors if present.
   * @param traffic Other cars to consider for collision/sensor readings.
   * @param pathBorders Path borders for collision detection.
   * @param markingWalls Marking detection helper walls
   */
  update(traffic: Car[], pathBorders: Edge[], markingWalls: MarkingWallJson[]) {
    this.draw(this.group, this.modelUrl);
    if (!this.damaged) {
      // Send control inputs to worker
      this.worker?.postMessage({
        type: WorkerInboundMessageType.UPDATE_CONTROLS,
        payload: {
          id: this.id,
          controls: {
            forward: this.controls.forward,
            reverse: this.controls.reverse,
            right: this.controls.right,
            left: this.controls.left,
          } as ControlInputs,
        } as UpdateControlsPayload,
      });

      // Send collision data to worker
      const effectivePathBorders =
        this.pathBorders && this.pathBorders.length > 0
          ? this.pathBorders
          : pathBorders;

      this.worker?.postMessage({
        type: WorkerInboundMessageType.UPDATE_COLLISION_DATA,
        payload: {
          id: this.id,
          traffic: traffic.map((car) => car.polygon?.toJson()),
          pathBorders: effectivePathBorders.map((pathBorder) =>
            pathBorder.toJson(),
          ),
          markingWalls,
        } as UpdateCollisionDataPayload,
      });
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
   * collider mesh. Also terminates the worker thread.
   */
  dispose() {
    // Terminate worker thread
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
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
   * Set the highlight state for this car.
   *
   * When highlighted, the car's collider mesh becomes more visible with
   * a gold/yellow color to indicate it's the current best performer.
   *
   * @param highlighted - Whether to highlight the car
   */
  setHighlighted(highlighted: boolean): void {
    if (this._isHighlighted === highlighted) return;

    this._isHighlighted = highlighted;
    this.updateColliderAppearance();
  }

  /**
   * Update a weight value in the neural network.
   * Sends the update to the worker thread.
   *
   * @param layerIdx Index of the layer (0-based, for weights between layer i and i+1)
   * @param fromIdx Index of the source neuron
   * @param toIdx Index of the target neuron
   * @param value New weight value
   */
  updateWeight(
    layerIdx: number,
    fromIdx: number,
    toIdx: number,
    value: number,
  ): void {
    this.worker?.postMessage({
      type: WorkerInboundMessageType.UPDATE_WEIGHT,
      payload: {
        id: this.id,
        layerIdx,
        fromIdx,
        toIdx,
        value,
      } as UpdateWeightPayload,
    });
  }

  /**
   * Update a bias value in the neural network.
   * Sends the update to the worker thread.
   *
   * @param layerIdx Index of the layer (0-based)
   * @param neuronIdx Index of the neuron
   * @param value New bias value
   */
  updateBias(layerIdx: number, neuronIdx: number, value: number): void {
    this.worker?.postMessage({
      type: WorkerInboundMessageType.UPDATE_BIAS,
      payload: {
        id: this.id,
        layerIdx,
        neuronIdx,
        value,
      } as UpdateBiasPayload,
    });
  }

  /**
   * Set the entire neural network brain from JSON.
   * Sends the brain data to the worker thread to replace the current network.
   *
   * @param brain The neural network JSON to set
   */
  setBrain(brain: NeuralNetworkJson): void {
    this.worker?.postMessage({
      type: WorkerInboundMessageType.SET_BRAIN,
      payload: {
        id: this.id,
        brain,
      } as SetBrainPayload,
    });
  }

  private ignoreDamageFromCars() {
    this.ignoreCarDamage = true;
    if (this.sensor) {
      this.sensor.ignoreTraffic = true;
    }
  }

  private initWorker() {
    if (!window.Worker) return;

    this.worker = new Worker(new URL("./car.worker.ts", import.meta.url));

    this.worker.onmessage = (event: MessageEvent<CarWorkerOutboundMessage>) => {
      const message = event.data;
      switch (message.type) {
        case WorkerOutboundMessageType.STATE_UPDATE: {
          const statePayload = message.payload;
          this.position = new Node(
            statePayload.position.x,
            statePayload.position.y,
          );
          this.angle = statePayload.angle;
          this.damaged = statePayload.damaged;
          // Reconstruct polygon from worker data
          if (statePayload.polygon) {
            this.polygon = Polygon.fromJson(statePayload.polygon);
          }
          this.network = statePayload.network;
          break;
        }
        case WorkerOutboundMessageType.SENSOR_UPDATE: {
          if (this.sensor && message.payload.id === this.id) {
            this.sensor.update(message.payload.rays, message.payload.readings);
          }
          break;
        }
      }
    };

    this.worker.postMessage({
      type: WorkerInboundMessageType.INIT,
      payload: {
        id: this.id,
        position: { x: this.position.x, y: this.position.y },
        breadth: this.breadth,
        length: this.length,
        height: this.height,
        speed: this.speed,
        acceleration: this.acceleration,
        maxSpeed: this.maxSpeed,
        friction: this.friction,
        angle: this.angle,
        damaged: this.damaged,
        sensor: {
          rayCount: this.sensor?.rayCount ?? 0,
          rayLength: this.sensor?.rayLength ?? 0,
          raySpreadAngle: this.sensor?.raySpreadAngle ?? 0,
          ignoreTraffic: this.sensor?.ignoreTraffic ?? false,
        },
        controlType: this.controls.type,
        controls: {
          forward: this.controls.forward,
          left: this.controls.left,
          right: this.controls.right,
          reverse: this.controls.reverse,
        },
        ignoreCarDamage: this.ignoreCarDamage,
      } as CarInitPayload,
    });
  }

  /**
   * Update the collider mesh appearance based on highlight state.
   */
  private updateColliderAppearance(): void {
    if (!this.carColliderMesh) return;

    const material = this.carColliderMesh.material;
    if (this._isHighlighted) {
      material.color.copy(Car.HIGHLIGHT_COLLIDER_COLOR);
      material.opacity = Car.HIGHLIGHT_COLLIDER_OPACITY;
    } else {
      material.color.copy(Car.DEFAULT_COLLIDER_COLOR);
      material.opacity = Car.DEFAULT_COLLIDER_OPACITY;
    }
  }
}
