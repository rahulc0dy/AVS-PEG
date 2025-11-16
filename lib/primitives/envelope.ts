import { angle, subtract, translate } from "@/utils/math";
import { Edge } from "@/lib/primitives/edge";
import { Node } from "@/lib/primitives/node";
import { Polygon } from "@/lib/primitives/polygon";
import { Color, Group } from "three";

/**
 * The Envelope class generates a polygon that represents a "thickened" version
 * of a line segment (skeleton). Think of it as a capsule or rectangular strip
 * built around an edge, optionally with rounded corners.
 */
export class Envelope {
  skeleton: Edge; // The base edge around which the envelope is built
  poly: Polygon; // The polygonal representation of the envelope

  /**
   * @param skeleton  The edge (line segment) around which to build the envelope
   * @param width     The thickness of the envelope (distance between outer sides)
   * @param roundness The number of segments used to approximate rounded ends (1 = flat, higher = smoother)
   */
  constructor(skeleton: Edge, width: number, roundness: number = 1) {
    if (!skeleton) {
      throw new Error("Invalid skeleton edge for envelope.");
    }

    this.skeleton = skeleton;
    this.poly = this.generatePolygon(width, roundness);
  }

  /**
   * Generates a polygon around the skeleton edge that represents the envelope.
   * The envelope is formed by sweeping a circle of radius = width/2
   * around both endpoints of the edge (like drawing a capsule shape).
   *
   * @param width     The total width of the envelope
   * @param roundness The number of interpolation steps for rounded ends
   * @returns         A Polygon instance representing the envelope area
   */
  private generatePolygon(width: number, roundness: number): Polygon {
    if (width <= 0) {
      throw new Error("Width must be positive.");
    }
    const { n1, n2 } = this.skeleton;

    // Compute geometry basics
    const radius = width / 2; // Half-width defines how far the envelope extends
    const baseAngle = angle(subtract(n1, n2)); // Angle of the skeleton edge relative to x-axis
    const angleCW = baseAngle + Math.PI / 2; // Angle perpendicular to edge (clockwise)
    const angleCCW = baseAngle - Math.PI / 2; // Angle perpendicular (counter-clockwise)

    // Prepare sampling step for rounded ends
    const nodes: Node[] = [];
    const step = Math.PI / Math.max(1, roundness); // Step size controls roundness (smaller = smoother)
    const epsilon = step / 2; // Small offset to ensure full coverage

    // Generate arc points around the first endpoint (n1)
    // This sweeps a half-circle (or less) from CCW to CW around n1.
    for (let theta = angleCCW; theta <= angleCW + epsilon; theta += step) {
      nodes.push(translate(n1, theta, radius));
    }

    // Generate arc points around the second endpoint (n2)
    // This sweeps another half-circle around n2, but offset by pi radians to connect smoothly.
    for (let theta = angleCCW; theta <= angleCW + epsilon; theta += step) {
      nodes.push(translate(n2, Math.PI + theta, radius));
    }

    // Return the final polygon wrapping both ends
    return new Polygon(nodes);
  }

  draw(group: Group, config: { fillColor: Color }) {
    this.poly.draw(group, config);
  }
}
