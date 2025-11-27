import { Group, PointLight, PointLightHelper, Vector3 } from "three";
import { Node } from "../primitives/node";
import { TrafficLightJson } from "@/types/save";
import { Marking } from "./marking";
import { GLTFLoader } from "three/examples/jsm/Addons.js";

export type LightState = "red" | "yellow" | "green";

const TRAFFIC_LIGHT_CONFIG = {
  red: {
    color: 0xff0000,
    relativePosition: new Vector3(-6.8, 15.9, -1.4),
  },
  yellow: {
    color: 0xffff00,
    relativePosition: new Vector3(-5.4, 15.9, -1.4),
  },
  green: {
    color: 0x00ff00,
    relativePosition: new Vector3(-4, 15.9, -1.4),
  },
};

const TRAFFIC_LIGHT_INTENSITY = 100;
const TRAFFIC_LIGHT_DISTANCE = 1.1;

export class TrafficLight extends Marking {
  private lightState!: LightState;
  private activeLight!: PointLight;

  constructor(position: Node, group: Group) {
    super(position, null as any, group, "traffic-light");
    this.setState("green");
  }

  setState(state: LightState) {
    this.lightState = state;
    this.activeLight = new PointLight(
      TRAFFIC_LIGHT_CONFIG[state].color,
      TRAFFIC_LIGHT_INTENSITY,
      TRAFFIC_LIGHT_DISTANCE
    );
    this.activeLight.position.set(
      this.position.x + TRAFFIC_LIGHT_CONFIG[state].relativePosition.x,
      0 + TRAFFIC_LIGHT_CONFIG[state].relativePosition.y,
      this.position.y + TRAFFIC_LIGHT_CONFIG[state].relativePosition.z
    );
  }

  update() {
    this.draw(this.group, this.modelUrl);
  }

  draw(target: Group, url: string, loader?: GLTFLoader) {
    super.draw(target, url, loader);

    if (this.activeLight && !this.group.children.includes(this.activeLight)) {
      this.group.add(this.activeLight);
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
