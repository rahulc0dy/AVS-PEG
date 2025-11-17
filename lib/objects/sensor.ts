import { Car } from "@/lib/objects/car";
import { getIntersection, Intersection, lerp } from "@/utils/math";
import { Edge } from "@/lib/primitives/edge";
import { Node } from "@/lib/primitives/node";
import { BufferGeometry, Color, Group, Line, LineBasicMaterial } from "three";

export class Sensor {
  car: Car;
  rayCount: number;
  rayLength: number;
  raySpread: number;

  rays: Edge[];
  readings: (Intersection | null | undefined)[];
  private lineGroup: Group;
  constructor(car: Car) {
    this.car = car;
    this.rayCount = 10;
    this.rayLength = 50;
    this.raySpread = Math.PI / 2;

    this.rays = [];
    this.readings = [];
    this.lineGroup = new Group();
  }

  update(roadBorders: Edge[], traffic: Car[]) {
    this.castRays();
    this.readings = [];
    for (let i = 0; i < this.rays.length; i++) {
      this.readings.push(this.getReading(this.rays[i], roadBorders, traffic));
    }
  }

  private getReading(ray: Edge, roadBorders: Edge[], traffic: Car[]) {
    let touches = [];

    for (let i = 0; i < roadBorders.length; i++) {
      const touch = getIntersection(
        ray.n1,
        ray.n2,
        roadBorders[i].n1,
        roadBorders[i].n2
      );
      if (touch) {
        touches.push(touch);
      }
    }

    for (let i = 0; i < traffic.length; i++) {
      const poly = traffic[i].polygon;
      if (poly === null) continue;
      for (let j = 0; j < poly.nodes.length; j++) {
        const value = getIntersection(
          ray.n1,
          ray.n2,
          poly.nodes[j],
          poly.nodes[(j + 1) % poly.nodes.length]
        );
        if (value) {
          touches.push(value);
        }
      }
    }

    if (touches.length == 0) {
      return null;
    } else {
      const offsets = touches.map((e) => e.offset);
      const minOffset = Math.min(...offsets);
      return touches.find((e) => e.offset == minOffset);
    }
  }

  private castRays() {
    this.rays = [];
    for (let i = 0; i < this.rayCount; i++) {
      const rayAngle =
        lerp(
          this.raySpread / 2,
          -this.raySpread / 2,
          this.rayCount == 1 ? 0.5 : i / (this.rayCount - 1)
        ) - this.car.angle;

      const start = new Node(this.car.position.x, this.car.position.y);
      const end = new Node(
        this.car.position.x + Math.sin(rayAngle) * this.rayLength,
        this.car.position.y - Math.cos(rayAngle) * this.rayLength
      );
      this.rays.push(new Edge(start, end));
    }
  }

  draw(group: Group) {
    if (!this.lineGroup.parent) {
      group.add(this.lineGroup);
    }
    this.lineGroup.clear(); // Clear previous lines

    for (let i = 0; i < this.rayCount; i++) {
      if (!this.rays[i]) continue;

      const endPos = this.readings[i]
        ? { x: this.readings[i]!.x, y: this.readings[i]!.y }
        : this.rays[i].n2;

      const points = [
        this.rays[i].n1.x,
        2,
        this.rays[i].n1.y,
        endPos.x,
        2,
        endPos.y,
      ];

      const geometry = new BufferGeometry();
      geometry.setAttribute(
        "position",
        new (require("three").Float32BufferAttribute)(points, 3)
      );

      const material = new LineBasicMaterial({
        color: this.readings[i] ? 0xff0000 : 0xffff00, // Red if hit, yellow otherwise
        linewidth: 2,
      });

      const line = new Line(geometry, material);
      this.lineGroup.add(line);
    }
  }

  dispose() {
    this.lineGroup.clear();
    if (this.lineGroup.parent) {
      this.lineGroup.parent.remove(this.lineGroup);
    }
  }
}
