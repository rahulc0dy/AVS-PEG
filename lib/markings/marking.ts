import { MarkingType } from "@/types/marking";
import { Node } from "../primitives/node";
import { Group, Material, Mesh, Object3D } from "three";
import { MarkingJson } from "@/types/save";
import { GLTFLoader } from "three/examples/jsm/Addons.js";
import { angle } from "@/utils/math";

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
  }

  /** Convenience update called by the world loop; draws the marking. */
  update() {
    this.draw(this.group, this.modelUrl);
  }

  /**
   * Draw the marking into `target`. If a model isn't loaded yet, this will
   * asynchronously load it via `GLTFLoader` and attach it when ready.
   * @param target Group to attach the model to.
   * @param url URL to the GLTF model.
   * @param loader Optional GLTFLoader instance to reuse.
   */
  draw(target: Group, url: string, loader?: GLTFLoader) {
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
  }

  /** Serialize this marking to JSON for saving. */
  toJson() {
    return {
      position: this.position.toJson(),
      direction: this.direction.toJson(),
      type: this.type,
    };
  }

  /**
   * Populate this marking from a serialized representation.
   * @param json Marking JSON loaded from disk or network.
   */
  fromJson(json: MarkingJson) {
    this.position.fromJson(json.position);
    this.direction.fromJson(json.direction);
    this.type = json.type;
  }
}
