import { Edge } from "@/lib/primitives/edge";
import { Node } from "@/lib/primitives/node";
import { Envelope } from "@/lib/primitives/envelope";
import { Polygon } from "@/lib/primitives/polygon";
import { RoadJson } from "@/types/save";
import {
  BackSide,
  Color,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  Shape,
  ShapeGeometry,
} from "three";
import {
  createLaneTexture,
  createArrowTexture,
} from "@/utils/road-surface-texture";
import { angle, subtract, translate } from "@/utils/math";
import { ARROW_SPACING } from "@/env";

export class Road extends Envelope {
  laneCount: number;
  roadType: string;
  width: number;
  roundness: number;

  private laneMesh: Mesh | null = null;
  private arrowMesh: Mesh | null = null;
  private baseMesh: Mesh | null = null;
  private showArrows: boolean = true;
  private fillColor: Color = new Color(0x222021);

  constructor(
    n1: Node,
    n2: Node,
    laneCount: number = 2,
    isDirected: boolean = false,
    roadType: string = "unclassified",
    width: number = 40,
    roundness: number = 10,
  ) {
    const skeleton = new Edge(n1, n2, isDirected);
    super(skeleton, width, roundness);

    this.laneCount = Math.max(1, laneCount);
    this.roadType = roadType;
    this.width = width;
    this.roundness = roundness;
  }

  get n1(): Node {
    return this.skeleton.n1;
  }

  get n2(): Node {
    return this.skeleton.n2;
  }

  get isDirected(): boolean {
    return this.skeleton.isDirected;
  }

  set isDirected(val: boolean) {
    this.skeleton.isDirected = val;
  }

  length(): number {
    return this.skeleton.length();
  }

  draw(group: Group, config?: { fillColor?: Color; showArrows?: boolean }) {
    if (!this.baseMesh) {
      this.baseMesh = this.createBaseMesh(config?.fillColor ?? this.fillColor);
    }
    if (!group.children.includes(this.baseMesh)) {
      group.add(this.baseMesh);
    }

    if (!this.laneMesh) {
      this.laneMesh = this.createLaneMesh();
    }
    if (!group.children.includes(this.laneMesh)) {
      group.add(this.laneMesh);
    }

    if (this.showArrows && !this.arrowMesh) {
      this.arrowMesh = this.createArrowMesh();
    }
    if (this.arrowMesh && !group.children.includes(this.arrowMesh)) {
      group.add(this.arrowMesh);
    }
  }

  private createBaseMesh(color: Color): Mesh {
    const material = new MeshBasicMaterial({
      color,
      side: BackSide,
    });

    const shape = new Shape();
    const nodes = this.poly.nodes;
    if (nodes.length > 0) {
      shape.moveTo(nodes[0].x, nodes[0].y);
      for (let i = 1; i < nodes.length; i++) {
        shape.lineTo(nodes[i].x, nodes[i].y);
      }
    }

    const geometry = new ShapeGeometry(shape);
    const mesh = new Mesh(geometry, material);
    mesh.rotation.x = Math.PI / 2;
    mesh.position.y = -0.02;

    return mesh;
  }

  dispose(): void {
    if (this.laneMesh) {
      this.laneMesh.geometry.dispose();
      const mat = this.laneMesh.material as MeshBasicMaterial;
      mat.map?.dispose();
      mat.dispose();
      this.laneMesh = null;
    }
    if (this.arrowMesh) {
      this.arrowMesh.geometry.dispose();
      const mat = this.arrowMesh.material as MeshBasicMaterial;
      mat.map?.dispose();
      mat.dispose();
      this.arrowMesh = null;
    }
    if (this.baseMesh) {
      this.baseMesh.geometry.dispose();
      (this.baseMesh.material as MeshBasicMaterial).dispose();
      this.baseMesh = null;
    }
  }

  regenerate() {
    this.poly = this.createPoly(this.width, this.roundness);
    this.dispose();
  }

  toJson(): RoadJson {
    return {
      ...super.toJson(),
      laneCount: this.laneCount,
      roadType: this.roadType,
    };
  }

  fromJson(json: RoadJson): void {
    if (json.skeleton) {
      this.skeleton.fromJson(json.skeleton);
    }

    this.laneCount = json.laneCount ?? 2;
    this.roadType = json.roadType ?? "unclassified";

    this.regenerate();
  }

  private createPoly(width: number, roundness: number): Polygon {
    const { n1, n2 } = this.skeleton;
    const radius = width / 2;
    const baseAngle = angle(subtract(n1, n2));
    const step = Math.PI / Math.max(1, roundness);
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

  private createLaneMesh(): Mesh {
    const length = this.length();
    const { laneCount } = this;

    const geometry = new PlaneGeometry(this.width, length);
    const texture = createLaneTexture(laneCount);

    const tileWorldSize = 8;
    texture.repeat.set(1, length / tileWorldSize);

    const material = new MeshBasicMaterial({
      map: texture,
      side: DoubleSide,
      transparent: true,
      depthWrite: false,
    });

    const mesh = new Mesh(geometry, material);

    const { n1, n2 } = this;
    mesh.position.set((n1.x + n2.x) / 2, 0.03, (n1.y + n2.y) / 2);

    const roadAngle = Math.atan2(n2.y - n1.y, n2.x - n1.x);
    mesh.rotation.x = -Math.PI / 2;
    mesh.rotation.z = -roadAngle + Math.PI / 2;

    return mesh;
  }

  private createArrowMesh(): Mesh | null {
    const length = this.length();
    const isOneWay = this.isDirected;

    const texture = createArrowTexture(this.laneCount, isOneWay, length);

    if (!texture) {
      return null;
    }

    const arrowSpacing = ARROW_SPACING;
    const numArrows = Math.max(1, Math.floor(length / arrowSpacing));
    const geometryHeight = numArrows * arrowSpacing;

    const geometry = new PlaneGeometry(this.width, geometryHeight);

    const material = new MeshBasicMaterial({
      map: texture,
      side: DoubleSide,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });

    const mesh = new Mesh(geometry, material);

    const { n1, n2 } = this;
    mesh.position.set((n1.x + n2.x) / 2, 0.03, (n1.y + n2.y) / 2);

    const roadAngle = Math.atan2(n2.y - n1.y, n2.x - n1.x);
    mesh.rotation.x = -Math.PI / 2;
    mesh.rotation.z = -roadAngle + Math.PI / 2;

    return mesh;
  }
}
