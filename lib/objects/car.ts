import { Material, Mesh, Vector2, Group, Object3D } from "three";
import { Sensor } from "@/lib/objects/sensor";
import { Controls, ControlType } from "@/lib/objects/controls";
import { Polygon } from "@/lib/primitives/polygon";
import { Edge } from "../primitives/edge";
import { Node } from "../primitives/node";
import { doPolygonsIntersect } from "@/utils/math";
import { GLTFLoader } from "three/examples/jsm/Addons.js";

export class Car {
  position: Vector2;
  width: number;
  height: number;
  speed: number;
  acceleration: number;
  maxSpeed: number;
  friction: number;
  angle: number;
  damaged: boolean;
  sensor: Sensor | null = null;
  controls: Controls;
  polygon: Polygon | null = null;
  private model: Group | null = null;
  private loadingModel = false;

  constructor(
    position: Vector2,
    width: number,
    height: number,
    controlType: string,
    angle = 0,
    maxSpeed = 3,
    color = "blue"
  ) {
    this.position = position;
    this.width = width;
    this.height = height;

    this.speed = 0;
    this.acceleration = 0.2;
    this.maxSpeed = maxSpeed;
    this.friction = 0.05;
    this.angle = angle;
    this.damaged = false;

    if (controlType != "DUMMY") {
      this.sensor = new Sensor(this);
    }
    this.controls = new Controls(controlType as ControlType);
  }

  update(roadBorders: Edge[], traffic: Car[]) {
    if (!this.damaged) {
      this.move();
      this.polygon = this.createPolygon();
      this.damaged = this.assessDamage(roadBorders, traffic);
    }
    if (this.sensor) {
      this.sensor.update(roadBorders, traffic);
      const offsets = this.sensor.readings.map((s) =>
        s == null ? 0 : 1 - s.offset
      );
    }
  }

  private assessDamage(roadBorders: Edge[], traffic: Car[]): boolean {
    if (this.polygon === null) return false;
    for (let i = 0; i < roadBorders.length; i++) {
      if (doPolygonsIntersect(this.polygon, new Polygon([roadBorders[i]]))) {
        return true;
      }
    }
    for (let i = 0; i < traffic.length; i++) {
      if (traffic[i].polygon === null) continue;
      if (doPolygonsIntersect(this.polygon, traffic[i].polygon!)) {
        return true;
      }
    }
    return false;
  }

  private createPolygon(): Polygon {
    const points = [];
    const rad = Math.hypot(this.width, this.height) / 2;
    const alpha = Math.atan2(this.width, this.height);
    points.push(
      new Node(
        this.position.x - Math.sin(this.angle - alpha) * rad,
        this.position.y - Math.cos(this.angle - alpha) * rad
      )
    );
    points.push(
      new Node(
        this.position.x - Math.sin(this.angle + alpha) * rad,
        this.position.y - Math.cos(this.angle + alpha) * rad
      )
    );
    points.push(
      new Node(
        this.position.x - Math.sin(Math.PI + this.angle - alpha) * rad,
        this.position.y - Math.cos(Math.PI + this.angle - alpha) * rad
      )
    );
    points.push(
      new Node(
        this.position.x - Math.sin(Math.PI + this.angle + alpha) * rad,
        this.position.y - Math.cos(Math.PI + this.angle + alpha) * rad
      )
    );
    return new Polygon(points);
  }

  private move() {
    if (this.controls.forward) {
      this.speed += this.acceleration;
    }
    if (this.controls.reverse) {
      this.speed -= this.acceleration;
    }

    if (this.speed > this.maxSpeed) {
      this.speed = this.maxSpeed;
    }
    if (this.speed < -this.maxSpeed / 2) {
      this.speed = -this.maxSpeed / 2;
    }

    if (this.speed > 0) {
      this.speed -= this.friction;
    }
    if (this.speed < 0) {
      this.speed += this.friction;
    }

    if (Math.abs(this.speed) < this.friction) {
      this.speed = 0;
    }

    if (this.speed != 0) {
      const flip = this.speed > 0 ? 1 : -1;
      if (this.controls.left) {
        this.angle += 0.03 * flip;
      }
      if (this.controls.right) {
        this.angle -= 0.03 * flip;
      }
    }

    this.position.x -= Math.sin(this.angle) * this.speed;
    this.position.y -= Math.cos(this.angle) * this.speed;
  }

  draw(target: Group, url: string, loader?: GLTFLoader) {
    if (this.sensor) {
      this.sensor.draw(target);
    }
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
          this.model.rotation.set(0, this.angle, 0);
          target.add(this.model);
        },
        undefined,
        () => {
          this.loadingModel = false;
        }
      );

      return;
    }

    this.model.position.set(this.position.x, 0, -this.position.y);
    this.model.rotation.set(0, this.angle, 0);
    if (!target.children.includes(this.model)) {
      target.add(this.model);
    }
  }

  dispose() {
    if (this.sensor) {
      this.sensor.dispose();
    }
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
    this.loadingModel = false;
  }
}
