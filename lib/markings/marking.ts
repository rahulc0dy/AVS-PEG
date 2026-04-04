import { MarkingType } from "@/types/marking";
import { Node } from "../primitives/node";
import { Group, Material, Mesh, Object3D } from "three";
import { MarkingJson } from "@/types/save";
import { GLTFLoader } from "three/examples/jsm/Addons.js";
import { angle, translate } from "@/utils/math";
import { Edge } from "@/lib/primitives/edge";
import { ROAD_WIDTH } from "@/env";
import { MarkingWallJson } from "@/types/car/message";

/**
 * Generic world marking.
 *
 * Markings are lightweight scene objects with a 2D world `position` and
 * `direction`. They can optionally load a GLTF model for visual representation
 * and are responsible for attaching/detaching their meshes to a provided
 * `Group`.
 */
export class Marking {
  /** World position of the marking (2D node: x, y). */
  position: Node;
  /** Direction/orientation encoded as a Node (used to compute rotation). */
  direction: Node;
  /** Discriminator for the marking type (controls model URL, behavior). */
  type: MarkingType;

  /** Parent group where the marking's meshes/lights will be attached. */
  group: Group;

  /** URL used to load the GLTF model for this marking. */
  modelUrl: string;
  /** Loaded model group (null until loaded). */
  model: Group | null = null;
  /** Internal flag indicating a model load is in progress. */
  protected loadingModel = false;
  /** Tracks whether this marking has been disposed to avoid resurrecting it via async loads. */
  private disposed = false;

  /**
   * Create a new `Marking`.
   * @param position World position for the marking.
   * @param direction Direction/orientation for the marking.
   * @param group Parent `Group` to attach preview/committed visuals to.
   * @param type Optional marking type (defaults to `default`).
   */
  constructor(
    position: Node,
    direction: Node,
    group: Group,
    type: MarkingType = "default",
  ) {
    this.position = position;
    this.direction = direction;
    this.group = group;
    this.type = type;
    this.modelUrl = `/models/${this.type}.gltf`;
    this.disposed = false;
  }

  /**
   * Deserializes a `Marking` instance from a plain JSON object.
   *
   * Reconstructs the position and direction `Node` instances from
   * the serialized data and creates a new `Marking` attached to
   * the provided Three.js group.
   *
   * @param json - Serialized marking data conforming to {@link MarkingJson}.
   * @param group - Three.js `Group` to attach the marking's model to.
   * @returns A new `Marking` instance with deserialized properties.
   */
  static fromJson(json: MarkingJson, group: Group): Marking {
    return new Marking(
      Node.fromJson(json.position),
      Node.fromJson(json.direction),
      group,
      json.type,
    );
  }

  /** Convenience update called by the world loop; draws the marking. */
  update() {
    this.draw(this.group, this.modelUrl);
  }

  /**
   * Generates a virtual wall perpendicular to the marking for sensor detection.
   * Actions/Labels are cleanly encapsulated inside the respective marking.
   */
  getMarkingWall(width: number = ROAD_WIDTH / 2): MarkingWallJson | null {
    if (
      this.type === "default" ||
      this.type === "source" ||
      this.type === "destination"
    ) {
      // No wall for these markings, as they don't require sensor detection.
      return null;
    }

    const ang = angle(this.direction);
    const n1 = translate(this.position, 0, 0);
    const n2 = translate(this.position, ang + Math.PI / 2, width);

    return {
      edge: new Edge(n1, n2).toJson(),
      label: this.type,
      direction: this.direction.toJson(),
    };
  }

  /**
   * Draw the marking into `target`. If a model isn't loaded yet, this will
   * asynchronously load it via `GLTFLoader` and attach it when ready.
   * @param target Group to attach the model to.
   * @param url URL to the GLTF model.
   * @param loader Optional GLTFLoader instance to reuse.
   */
  draw(target: Group, url: string, loader?: GLTFLoader) {
    if (this.disposed) return;
    if (!this.model) {
      if (this.loadingModel) return;
      this.loadingModel = true;
      if (!loader) loader = new GLTFLoader();
      loader.load(
        url,
        (gltf) => {
          this.loadingModel = false;
          if (this.disposed) {
            this.disposeModel(gltf.scene);
            return;
          }
          this.model = gltf.scene;
          this.model.scale.set(3, 3, 3);
          this.model.position.set(this.position.x, 0, this.position.y);
          target.add(this.model);
        },
        undefined,
        () => {
          this.loadingModel = false;
        },
      );

      return;
    }

    const ang = angle(this.direction);
    this.model.rotation.set(0, -ang + Math.PI / 2, 0);
    this.model.position.set(this.position.x, 0, this.position.y);

    if (!target.children.includes(this.model)) {
      target.add(this.model);
    }
  }

  /**
   * Dispose of the loaded model and free GPU resources (geometries/materials).
   */
  dispose() {
    this.disposed = true;
    if (!this.model) return;
    if (this.model.parent) {
      this.model.parent.remove(this.model);
    }
    this.disposeModel(this.model);
    this.model = null;
  }

  /**
   * Serializes this marking to a plain JSON object.
   *
   * The returned object conforms to {@link MarkingJson} and includes
   * position, direction, and type. Can be passed to {@link Marking.fromJson}
   * or subclass `fromJson` methods to reconstruct the marking.
   *
   * @returns A {@link MarkingJson} object containing serialized marking data.
   */
  toJson() {
    return {
      position: this.position.toJson(),
      direction: this.direction.toJson(),
      type: this.type,
    };
  }

  private disposeModel(model: Group) {
    model.traverse((child: Object3D) => {
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
  }
}
