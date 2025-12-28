import { angle, subtract, translate } from "@/utils/math";
import { Node } from "@/lib/primitives/node";
import { Road } from "@/lib/primitives/road";
import { Polygon } from "@/lib/primitives/polygon";
import {
  Color,
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  DoubleSide,
} from "three";
import { EnvelopeJson, RoadJson } from "@/types/save";
import { createRoadTexture } from "@/utils/road-surface-texture";

export class RoadEnvelope {
  road: Road;
  poly: Polygon;
  width: number;
  roundness: number;

  private fillColor: Color;
  private showArrows: boolean;
  private mesh: Mesh | null = null;

  constructor(
    road: Road,
    width: number,
    roundness: number = 1,
    config: { fillColor?: Color; showArrows?: boolean } = {},
  ) {
    this.road = road;
    this.width = width;
    this.roundness = roundness;
    this.fillColor = config.fillColor ?? new Color(0x2a2a2a);
    this.showArrows = config.showArrows ?? true;
    this.poly = this.createPoly();
  }

  private createPoly(): Polygon {
    const { n1, n2 } = this.road;
    const radius = this.width / 2;
    const baseAngle = angle(subtract(n1, n2));
    const step = Math.PI / Math.max(1, this.roundness);

    const nodes: Node[] = [];

    for (
      let t = baseAngle - Math.PI / 2;
      t <= baseAngle + Math.PI / 2 + step / 2;
      t += step
    ) {
      nodes.push(translate(n1, t, radius));
    }

    for (
      let t = baseAngle - Math.PI / 2;
      t <= baseAngle + Math.PI / 2 + step / 2;
      t += step
    ) {
      nodes.push(translate(n2, Math.PI + t, radius));
    }

    return new Polygon(nodes);
  }

  private createMesh(): Mesh {
    const length = this.road.length();
    const { laneCount, isDirected } = this.road;

    const geometry = new PlaneGeometry(this.width, length);
    const texture = createRoadTexture({
      laneCount,
      isOneWay: isDirected,
      roadLength: length,
      showArrows: this.showArrows,
    });

    const material = new MeshBasicMaterial({
      map: texture,
      side: DoubleSide,
    });

    const mesh = new Mesh(geometry, material);

    const { n1, n2 } = this.road;
    mesh.position.set((n1.x + n2.x) / 2, 0.01, (n1.y + n2.y) / 2);

    const roadAngle = Math.atan2(n2.y - n1.y, n2.x - n1.x);
    mesh.rotation.x = -Math.PI / 2;
    mesh.rotation.z = -roadAngle + Math.PI / 2;

    return mesh;
  }

  draw(group: Group, config?: { fillColor?: Color }): void {
    this.poly.draw(group, { fillColor: config?.fillColor ?? this.fillColor });

    if (!this.mesh) {
      this.mesh = this.createMesh();
    }
    if (!group.children.includes(this.mesh)) {
      group.add(this.mesh);
    }
  }

  toJson(): EnvelopeJson & { road?: RoadJson } {
    return {
      skeleton: this.road.toJson(),
      poly: this.poly.toJson(),
      road: this.road.toJson(),
    };
  }

  fromJson(json: EnvelopeJson & { road?: RoadJson }): void {
    if (json.road) {
      this.road.fromJson(json.road);
    } else {
      this.road.fromJson(json.skeleton as RoadJson);
    }
    this.poly.fromJson(json.poly);
    this.dispose();
  }

  dispose(): void {
    if (this.mesh) {
      this.mesh.geometry.dispose();
      const mat = this.mesh.material as MeshBasicMaterial;
      mat.map?.dispose();
      mat.dispose();
      this.mesh = null;
    }
  }
}
