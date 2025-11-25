import {
  Color,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  Scene,
  SphereGeometry,
  Vector3,
} from "three";
import { Edge } from "../primitives/edge";
import { BaseEditor } from "./base-editor";

interface Marking {
  edge: Edge;
  t: number; // parametric
  point: Vector3;
  direction: Vector3;
  mesh: Object3D;
  isPreview?: boolean;
}

function makeSphere(point: Vector3, color: Color | string, scale = 0.03): Mesh {
  const geo = new SphereGeometry(1, 12, 8);
  const mat = new MeshBasicMaterial({ color });
  const mesh = new Mesh(geo, mat);
  mesh.position.copy(point);
  mesh.scale.setScalar(scale);
  return mesh;
}

function edgeEndpoints(edge: Edge): { a: Vector3; b: Vector3 } {
  const a = new Vector3(edge.n1.x, 0, edge.n1.y);
  const b = new Vector3(edge.n2.x, 0, edge.n2.y);
  return { a, b };
}

function projectPointOnEdge(edge: Edge, point: Vector3) {
  const { a, b } = edgeEndpoints(edge);
  const ab = new Vector3().subVectors(b, a);
  const direction = ab.clone().normalize();
  const ap = new Vector3().subVectors(point, a);
  const lenSq = ab.lengthSq();
  if (lenSq === 0) {
    return {
      projected: a.clone(),
      t: 0,
      distanceSq: ap.lengthSq(),
      direction: new Vector3(1, 0, 0),
    };
  }
  let t = ap.dot(ab) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const projected = new Vector3().copy(a).add(ab.multiplyScalar(t));
  const distanceSq = projected.distanceToSquared(point);
  return { projected, t, distanceSq, direction };
}

export class MarkingEditor extends BaseEditor {
  markings: Marking[] = [];
  targetSegments: Edge[];
  protected hover?: Marking;
  constructor(scene: Scene, targetSegments: Edge[]) {
    super(scene);
    this.targetSegments = targetSegments;
  }

  createMarking(
    point: Vector3,
    direction: Vector3,
    color = new Color(0x00ffff),
    scale = 1
  ): Object3D {
    return makeSphere(point, color, scale);
  }

  private updateHover(point: Vector3) {
    let best: {
      edge: Edge;
      t: number;
      point: Vector3;
      distanceSq: number;
      direction: Vector3;
    } | null = null;

    for (const edge of this.targetSegments) {
      const { projected, t, distanceSq, direction } = projectPointOnEdge(
        edge,
        point
      );
      if (!best || distanceSq < best.distanceSq)
        best = { edge, t, point: projected, distanceSq, direction };
    }
    if (!best) {
      this.clearHover();
      return;
    }

    const maxdistSq = 2 * 2;
    if (best.distanceSq > maxdistSq) {
      this.clearHover();
      return;
    }

    if (this.hover) {
      this.hover.point.copy(best.point);
      this.hover.direction.copy(best.direction);
      this.hover.mesh.position.copy(best.point);
      this.hover.mesh.lookAt(best.point.clone().add(best.direction));
      this.hover.t = best.t;
      this.hover.edge = best.edge;
      return;
    }

    const mesh = this.createMarking(best.point, best.direction);
    mesh.lookAt(best.point.clone().add(best.direction));
    const marking: Marking = {
      edge: best.edge,
      t: best.t,
      point: best.point.clone(),
      direction: best.direction.clone(),
      mesh,
      isPreview: true,
    };
    this.scene.add(mesh);
    this.hover = marking;
  }

  protected clearHover() {
    if (this.hover) {
      this.scene.remove(this.hover.mesh);
      if (this.hover.mesh instanceof Mesh) {
        this.hover.mesh.geometry.dispose();
        this.hover.mesh.material.dispose();
      }
      this.hover = undefined;
    }
  }

  draw(): boolean {
    return !!this.hover;
  }

  handlePointerMove(point: Vector3): void {
    this.updateHover(point);
  }

  handleLeftClick(_point: Vector3): void {
    if (!this.hover) return;
    const committed = this.hover;
    committed.isPreview = false;
    this.scene.remove(committed.mesh);

    // Maybe mesh on other markings
    if (committed.mesh instanceof Mesh) {
      committed.mesh.geometry.dispose();
      committed.mesh.material.dispose?.();
    }

    committed.mesh = makeSphere(committed.point, new Color(0xffff00), 0.04);
    committed.mesh.lookAt(committed.point.clone().add(committed.direction));

    this.scene.add(committed.mesh);
    this.markings.push(committed);
    this.hover = undefined;
  }

  handleRightClick(point: Vector3): void {
    let bestIndex = -1;
    let minDistanceSq = Infinity;
    const thresholdSq = 2 * 2;

    for (let i = 0; i < this.markings.length; i++) {
      const marking = this.markings[i];
      const distSq = marking.point.distanceToSquared(point);
      if (distSq < minDistanceSq && distSq < thresholdSq) {
        minDistanceSq = distSq;
        bestIndex = i;
      }
    }

    if (bestIndex !== -1) {
      const toRemove = this.markings[bestIndex];
      this.scene.remove(toRemove.mesh);
      if (toRemove.mesh instanceof Mesh) {
        toRemove.mesh.geometry.dispose();
        toRemove.mesh.material.dispose?.();
      }
      this.markings.splice(bestIndex, 1);
    }

    this.clearHover();
  }

  handleClickRelease(_point: Vector3): void {
    // No-op
  }
}
