import { MarkingType } from "@/types/marking";
import { Edge } from "../primitives/edge";
import { Node } from "../primitives/node";
import { Group } from "three";
import { MarkingJson } from "@/types/save";
import { GLTFLoader } from "three/examples/jsm/Addons.js";

export class Marking {
  position: Node;
  direction: Edge;
  type: MarkingType;

  group: Group;

  modelUrl: string;
  model: Group | null = null;
  protected loadingModel = false;

  constructor(
    position: Node,
    direction: Edge,
    group: Group,
    type: MarkingType = "default"
  ) {
    this.position = position;
    this.direction = direction;
    this.group = group;
    this.type = type;
    this.modelUrl = `/models/${this.type}.gltf`;
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
        }
      );

      return;
    }

    this.model.position.set(this.position.x, 0, this.position.y);
    if (!target.children.includes(this.model)) {
      target.add(this.model);
    }
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
  }
}
