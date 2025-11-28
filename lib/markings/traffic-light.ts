import { Group, PointLight, PointLightHelper, Vector3 } from "three";
import { Node } from "../primitives/node";
import { TrafficLightJson } from "@/types/save";
import { Marking } from "./marking";
import { GLTFLoader } from "three/examples/jsm/Addons.js";
import { angle, add, translate, distance } from "@/utils/math";

export type LightState = "red" | "yellow" | "green";

const TRAFFIC_LIGHT_CONFIG = {
  red: {
    color: 0xff0000,
    relativePosition: new Node(-6.8, -1.4),
  },
  yellow: {
    color: 0xffff00,
    relativePosition: new Node(-5.4, -1.4),
  },
  green: {
    color: 0x00ff00,
    relativePosition: new Node(-4, -1.4),
  },
};

const TRAFFIC_LIGHT_INTENSITY = 100;
const TRAFFIC_LIGHT_DISTANCE = 1.1;
const TRAFFIC_LIGHT_HEIGHT = 15.9;

export class TrafficLight extends Marking {
  private lightState!: LightState;
  private activeLight!: PointLight | null;
  private activeLightHelper!: PointLightHelper | null;

  // Toggle to show/hide the PointLightHelper for debugging/visualization
  private showHelper: boolean = true;

  constructor(position: Node, direction: Node, group: Group) {
    super(position, direction, group, "traffic-light");
    this.setState("red");
  }

  setState(state: LightState) {
    this.lightState = state;
    this.activeLight = new PointLight(
      TRAFFIC_LIGHT_CONFIG[state].color,
      TRAFFIC_LIGHT_INTENSITY,
      TRAFFIC_LIGHT_DISTANCE
    );
    this.activeLightHelper = new PointLightHelper(this.activeLight);
    this.setLightPosition();
  }

  setLightPosition() {
    if (this.activeLight) {
      // Rotate the configured relative XZ offset by the marking's direction
      // so the light follows the marking orientation.
      const relativePosition =
        TRAFFIC_LIGHT_CONFIG[this.lightState].relativePosition;
      const ang = angle(this.direction);

      // use Node + utils.add to compute world position
      const relativeNodeTranslatedOnX = translate(
        this.position,
        ang - Math.PI / 2, // perpendicular to the forward direction
        relativePosition.x
      );

      const relativeNodeTranslatedOnXZ = translate(
        relativeNodeTranslatedOnX,
        ang,
        relativePosition.y
      );

      this.activeLight.position.set(
        relativeNodeTranslatedOnXZ.x,
        TRAFFIC_LIGHT_HEIGHT,
        relativeNodeTranslatedOnXZ.y
      );
      if (this.activeLightHelper) {
        this.activeLightHelper.position.copy(this.activeLight.position);
      }
    }
  }

  update() {
    this.draw(this.group, this.modelUrl);
  }

  draw(target: Group, url: string, loader?: GLTFLoader) {
    super.draw(target, url, loader);

    if (this.activeLight) {
      // Update light world position every draw
      this.setLightPosition();
      // Ensure the light is attached to the provided target group (world group)
      if (!target.children.includes(this.activeLight)) {
        target.add(this.activeLight);
      }
      // Add or remove the helper according to `showHelper` flag
      if (this.activeLightHelper) {
        if (this.showHelper) {
          if (!target.children.includes(this.activeLightHelper)) {
            target.add(this.activeLightHelper);
          }
        } else {
          if (this.activeLightHelper.parent) {
            this.activeLightHelper.parent.remove(this.activeLightHelper);
          }
        }
      }
    }
  }

  dispose(): void {
    super.dispose();
    if (this.activeLight) {
      if (this.activeLight.parent) {
        this.activeLight.parent.remove(this.activeLight);
      }
      this.activeLight = null;
    }
    if (this.activeLightHelper) {
      if (this.activeLightHelper.parent) {
        this.activeLightHelper.parent.remove(this.activeLightHelper);
      }
      this.activeLightHelper = null;
    }
  }

  toJson() {
    return {
      position: this.position.toJson(),
      direction: this.direction.toJson(),
      type: this.type,
      lightState: this.lightState,
    };
  }

  fromJson(json: TrafficLightJson) {
    super.fromJson(json);
    this.setState(json.lightState);
  }
}
