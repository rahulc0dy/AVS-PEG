import {
  Scene,
  Vector3,
  Mesh,
  BoxGeometry,
  MeshBasicMaterial,
  Object3D,
  Group,
} from "three";
import { Edge } from "../primitives/edge";
import { MarkingEditor } from "./marking-editor";
import { LightState, TrafficLight } from "../markings/traffic-light";
import { Node } from "../primitives/node";
import { ROAD_WIDTH } from "@/env";

export class TrafficLightEditor extends MarkingEditor {
  private trafficLight: TrafficLight;

  constructor(scene: Scene, targetSegments: Edge[]) {
    super(scene, targetSegments);
    this.trafficLight = new TrafficLight(
      new Node(0, 0),
      new Node(0, 0),
      new Group()
    );
  }

  // Preview
  override createMarking(point: Vector3, direction: Vector3): Object3D {
    const container = new Group();
    container.position.copy(point);
    container.lookAt(point.clone().add(direction));
    container.position.y += 0.3;

    // Create a preview TrafficLight
    const previewTrafficLight = new TrafficLight(
      new Node(ROAD_WIDTH, 0),
      new Node(0, 0),
      container
    );
    previewTrafficLight.setState("green");
    previewTrafficLight.update();

    // Set all materials in the container to low opacity for preview
    container.traverse((child) => {
      if ((child as Mesh).material) {
        const mat = (child as Mesh).material as MeshBasicMaterial;
        mat.transparent = true;
        mat.opacity = 0.3;
        mat.depthWrite = false;
      }
    });

    return container;
  }

  override handleLeftClick(_point: Vector3): void {
    if (!this.hover) return;

    const committed = this.hover;
    committed.isPreview = false;

    this.scene.remove(committed.mesh);
    if (committed.mesh instanceof Mesh) {
      committed.mesh.geometry.dispose();
      committed.mesh.material.dispose();
    }

    const container = new Group();
    container.position.copy(committed.point);
    container.lookAt(committed.point.clone().add(committed.direction));

    this.scene.add(container);

    // RENDERING LIGHT
    this.trafficLight = new TrafficLight(
      new Node(ROAD_WIDTH, 0),
      new Node(0, 0),
      container
    );
    this.trafficLight.setState("green");
    this.trafficLight.update();

    committed.mesh = container;

    committed.mesh.userData = { trafficLight: this.trafficLight };

    this.markings.push(committed);
    this.hover = undefined;
  }
}
