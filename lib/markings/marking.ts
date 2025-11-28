import { MarkingType } from "@/types/marking";
import { Node } from "../primitives/node";
import { Group, Material, Mesh, Object3D } from "three";
import { MarkingJson } from "@/types/save";
import { GLTFLoader } from "three/examples/jsm/Addons.js";
import { angle } from "@/utils/math";

export class Marking {
  position: Node;
  direction: Node;
  type: MarkingType;

  group: Group;

  modelUrl: string;
  model: Group | null = null;
  protected loadingModel = false;

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

  update() {
    this.draw(this.group, this.modelUrl);
  }

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

  toJson() {
    return {
      position: this.position.toJson(),
      direction: this.direction.toJson(),
      type: this.type,
    };
  }

  fromJson(json: MarkingJson) {
    this.position.fromJson(json.position);
    this.direction.fromJson(json.direction);
    this.type = json.type;
    1;
  }
}
