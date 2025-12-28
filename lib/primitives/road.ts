import { Edge } from "./edge";
import { Node } from "./node";
import { RoadJson } from "@/types/save";

export class Road extends Edge {
  laneCount: number;
  roadType: string;

  constructor(
    n1: Node,
    n2: Node,
    laneCount: number = 2,
    isDirected: boolean = false,
    roadType: string = "unclassified",
  ) {
    super(n1, n2, isDirected);
    this.laneCount = Math.max(1, laneCount);
    this.roadType = roadType;
  }

  getLanesPerDirection(): { forward: number; backward: number } {
    if (this.isDirected) {
      return { forward: this.laneCount, backward: 0 };
    }
    const forward = Math.ceil(this.laneCount / 2);
    const backward = Math.floor(this.laneCount / 2);
    return { forward, backward };
  }

  needsCenterDivider(): boolean {
    return !this.isDirected && this.laneCount >= 2;
  }

  getLaneWidth(totalRoadWidth: number): number {
    return totalRoadWidth / this.laneCount;
  }

  toJson(): RoadJson {
    return {
      ...super.toJson(),
      laneCount: this.laneCount,
      roadType: this.roadType,
    };
  }

  fromJson(json: RoadJson): void {
    super.fromJson(json);
    this.laneCount = json.laneCount ?? 2;
    this.roadType = json.roadType ?? "unclassified";
  }
}
