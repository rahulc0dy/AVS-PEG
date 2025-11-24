import { Group, PointLight, PointLightHelper, Vector3 } from "three";
import { GLTFLoader } from "three/examples/jsm/Addons.js";
import { Node } from "../primitives/node";
import { TrafficLightJson } from "@/types/save";

export enum LightState {
  RED,
  YELLOW,
  GREEN,
}

export const trafficLight = {
  RED: {
    color: 0xff0000,
    relativePosition: new Vector3(-6.8, 15.9, 1.4),
  },
  YELLOW: {
    color: 0xffff00,
    relativePosition: new Vector3(-5.4, 15.9, 1.4),
  },
  GREEN: {
    color: 0x00ff00,
    relativePosition: new Vector3(-4, 15.9, 1.4),
  },
};

const TRAFFIC_LIGHT_INTENSITY = 100;
const TRAFFIC_LIGHT_DISTANCE = 1.1;

export class TrafficLight {
  /** Position in world units. `y` maps to Three.js Z when rendering. */
  position: Node;

  /** URL used to lazily load the GLTF model for this traffic light. */
  private modelUrl: string = "/models/traffic-light.gltf";
  /** Root group returned by the GLTF loader (null until loaded). */
  private model: Group | null = null;
  /** Simple guard to prevent concurrent model loads. */
  private loadingModel = false;

  /** Parent Three.js group where this car attaches its meshes. */
  private group: Group;

  private lightState: LightState = LightState.GREEN;

  private lights: PointLight[] = [];

  private redLight: PointLight | undefined;
  private yellowLight: PointLight | undefined;
  private greenLight: PointLight | undefined;

  constructor(position: Node, group: Group) {
    this.position = position;
    this.group = group;

    this.initLights();
  }

  private initLights() {
    this.redLight = new PointLight(
      trafficLight.RED.color,
      TRAFFIC_LIGHT_INTENSITY,
      TRAFFIC_LIGHT_DISTANCE
    );
    this.redLight.position.set(
      this.position.x + trafficLight.RED.relativePosition.x,
      0 + trafficLight.RED.relativePosition.y,
      this.position.y + trafficLight.RED.relativePosition.z
    );

    this.yellowLight = new PointLight(
      trafficLight.YELLOW.color,
      TRAFFIC_LIGHT_INTENSITY,
      TRAFFIC_LIGHT_DISTANCE
    );
    this.yellowLight.position.set(
      this.position.x + trafficLight.YELLOW.relativePosition.x,
      0 + trafficLight.YELLOW.relativePosition.y,
      this.position.y + trafficLight.YELLOW.relativePosition.z
    );

    this.greenLight = new PointLight(
      trafficLight.GREEN.color,
      TRAFFIC_LIGHT_INTENSITY,
      TRAFFIC_LIGHT_DISTANCE
    );
    this.greenLight.position.set(
      this.position.x + trafficLight.GREEN.relativePosition.x,
      0 + trafficLight.GREEN.relativePosition.y,
      this.position.y + trafficLight.GREEN.relativePosition.z
    );
  }

  setState(state: LightState) {
    this.lightState = state;
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
        }
      );

      return;
    }
    let pointLightHelper: PointLightHelper;

    if (this.redLight && this.yellowLight && this.greenLight) {
      switch (this.lightState) {
        case LightState.RED:
          this.group.add(this.redLight);
          this.group.remove(this.yellowLight);
          this.group.remove(this.greenLight);

          pointLightHelper = new PointLightHelper(this.redLight, 1); // sphereSize determines helper's visual size
          break;
        case LightState.YELLOW:
          this.group.add(this.yellowLight);
          this.group.remove(this.redLight);
          this.group.remove(this.greenLight);

          pointLightHelper = new PointLightHelper(this.yellowLight, 1); // sphereSize determines helper's visual size
          break;
        case LightState.GREEN:
          this.group.add(this.greenLight);
          this.group.remove(this.redLight);
          this.group.remove(this.yellowLight);

          pointLightHelper = new PointLightHelper(this.greenLight, 1); // sphereSize determines helper's visual size
          break;
      }
    }
    // this.group.add(pointLightHelper);

    this.model.position.set(this.position.x, 0, this.position.y);
    if (!target.children.includes(this.model)) {
      target.add(this.model);
    }
  }

  toJson() {
    return {
      position: this.position.toJson(),
      lightState: this.lightState,
    };
  }

  fromJson(json: TrafficLightJson) {
    this.position.fromJson(json.position);
    this.lightState = json.lightState;

    this.initLights();
  }
}
