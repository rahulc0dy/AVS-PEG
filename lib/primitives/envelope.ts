import { angle, subtract, translate } from "@/utils/math";
import { Edge } from "@/lib/primitives/edge";
import { Node } from "@/lib/primitives/node";
import { Polygon } from "@/lib/primitives/polygon";
import { Color, Group } from "three";
import { EnvelopeJson } from "@/types/save";

/**
 * The Envelope class generates a polygon that represents a "thickened"
 * version of a line segment (skeleton). Think of it as a capsule or
 * rectangular strip built around an `Edge`, optionally with rounded ends.
 */
export class Envelope {
  /** The base edge around which the envelope is built. */
  skeleton: Edge;
  /** The polygonal representation of the envelope area. */
  poly: Polygon;

  /**
   * Construct an envelope around `skeleton`.
   * @param skeleton - Edge to thicken (must be non-null)
   * @param width - Total width of the envelope (must be > 0)
   * @param roundness - Controls how many segments approximate rounded ends
   *                    (1 = flat ends, larger values = smoother arcs)
   */
  constructor(skeleton: Edge, width: number, roundness: number = 1) {
    if (!skeleton) {
      throw new Error("Invalid skeleton edge for envelope.");
    }

    this.skeleton = skeleton;
    this.poly = this.generatePolygon(width, roundness);
  }

  /**
   * Generate a polygon that surrounds the skeleton edge. The algorithm
   * samples points by sweeping arcs of radius `width/2` around each
   * endpoint and concatenates them to form a closed polygon (a capsule-like
   * shape). Returned polygon lies in the X-Y plane (consistent with Node coords).
   *
   * Note: `roundness` controls sampling density for the arc; higher values
   * produce smoother end-caps at the cost of more vertices.
   *
   * @param width - Total width of the envelope (positive number)
   * @param roundness - Number of subdivisions used for the semicircular ends
   * @returns A `Polygon` approximating the envelope area
   */
  protected generatePolygon(width: number, roundness: number): Polygon {
    if (width <= 0) {
      throw new Error("Width must be positive.");
    }
    const { n1, n2 } = this.skeleton;

    // Compute geometry basics
    const radius = width / 2; // Half-width defines how far the envelope extends
    const baseAngle = angle(subtract(n1, n2)); // Angle of the skeleton edge
    const angleCW = baseAngle + Math.PI / 2; // Perpendicular (clockwise)
    const angleCCW = baseAngle - Math.PI / 2; // Perpendicular (counter-clockwise)

    // Prepare sampling step for rounded ends
    const nodes: Node[] = [];
    const step = Math.PI / Math.max(1, roundness); // Smaller step -> smoother arc
    const epsilon = step / 2; // Small offset to ensure full coverage

    // Arc around the first endpoint (n1): sweep from CCW -> CW
    for (let theta = angleCCW; theta <= angleCW + epsilon; theta += step) {
      nodes.push(translate(n1, theta, radius));
    }

    // Arc around the second endpoint (n2): sweep a semicircle offset by PI
    // to connect smoothly with the first arc and form the opposite side.
    for (let theta = angleCCW; theta <= angleCW + epsilon; theta += step) {
      nodes.push(translate(n2, Math.PI + theta, radius));
    }

    // Create and return the polygon that wraps both arc sequences
    return new Polygon(nodes);
  }

  /**
   * Draw the envelope by delegating to the underlying polygon's draw method.
   * @param group - Three.js `Group` to add the envelope mesh to
   * @param config - Rendering config (expects `fillColor`)
   */
  draw(group: Group, config: { fillColor: Color }) {
    this.poly.draw(group, config);
  }

  /**
   * Releases all Three.js resources (geometries, materials, textures).
   */
  dispose(): void {
    this.poly.dispose();
  }

  /**
   * Serialize the envelope to JSON including its skeleton edge and polygon.
   */
  toJson() {
    return {
      skeleton: this.skeleton.toJson(),
      poly: this.poly.toJson(),
    };
  }

  /**
   * Restore envelope state from JSON. This updates the skeleton and polygon
   * structures in-place.
   * @param json Serialized envelope data
   */
  fromJson(json: EnvelopeJson) {
    this.skeleton.fromJson(json.skeleton);
    this.poly.fromJson(json.poly);
  }
}
