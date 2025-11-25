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
import { TrafficLight } from "../markings/traffic-light";
import { Node } from "../primitives/node";

export class TrafficLightEditor extends MarkingEditor {
  private static BOX_WIDTH = 2;
  private static BOX_HEIGHT = 5;
  private static BOX_DEPTH = 2;
  private static TRAFFIC_LIGHT_POSITION_OFFSET = 20;

  constructor(scene: Scene, targetSegments: Edge[]) {
    super(scene, targetSegments);
  }

  // Preview
  override createMarking(point: Vector3, direction: Vector3): Object3D {
    const geometry = new BoxGeometry(
      TrafficLightEditor.BOX_WIDTH,
      TrafficLightEditor.BOX_HEIGHT,
      TrafficLightEditor.BOX_DEPTH
    );
    const material = new MeshBasicMaterial({ color: 0x00ff00 });
    const mesh = new Mesh(geometry, material);

    mesh.position.copy(point);
    mesh.lookAt(point.clone().add(direction));
    mesh.position.y += 0.3;

    return mesh;
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
    const trafficLight = new TrafficLight(
      new Node(TrafficLightEditor.TRAFFIC_LIGHT_POSITION_OFFSET, 0),
      container
    );
    trafficLight.update();

    committed.mesh = container;

    committed.mesh.userData = { trafficLight };

    this.markings.push(committed);
    this.hover = undefined;
  }
}
