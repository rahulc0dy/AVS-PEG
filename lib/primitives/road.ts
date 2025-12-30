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
  createArrowTexture,
  createLaneTexture,
} from "@/utils/road-surface-texture";
import { angle, subtract, translate } from "@/utils/math";
import { ARROW_SPACING, ROAD_ROUNDNESS, ROAD_WIDTH } from "@/env";

/**
 * Represents a road segment in the world, extending {@link Envelope} to provide
 * visual geometry with rounded end caps.
 *
 * A Road consists of three visual layers:
 * 1. **Base mesh**: The solid road surface (asphalt color)
 * 2. **Lane mesh**: Dashed lane divider lines
 * 3. **Arrow mesh**: Directional traffic flow arrows
 *
 * ## Coordinate System
 *
 * - Roads are defined by two endpoint nodes (`n1` and `n2`)
 * - The skeleton edge runs from `n1` to `n2`
 * - Lane directions are determined by the road's `isDirected` property
 *
 * ## Visual Layers (Y-axis stacking)
 *
 * ```
 * Y = 0.03  ─── Lane markings & arrows (transparent overlays)
 * Y = -0.02 ─── Base road surface
 * ```
 *
 * @extends Envelope
 *
 * @example
 * ```ts
 * const road = new Road(nodeA, nodeB, 4, false, "primary");
 * road.draw(worldGroup);
 * ```
 */
export class Road extends Envelope {
  /** Number of lanes on this road segment */
  laneCount: number;
  /** OSM road classification (e.g., "primary", "secondary", "unclassified") */
  roadType: string;
  /** Width of the road in world units */
  width: number;
  /** Smoothness of the rounded end caps (higher = smoother) */
  roundness: number;

  /** Cached mesh for lane divider lines (dashed white lines) */
  private laneMesh: Mesh | null = null;
  /** Cached mesh for directional arrows */
  private arrowMesh: Mesh | null = null;
  /** Cached mesh for the solid road surface */
  private baseMesh: Mesh | null = null;
  /** Whether to display directional arrows on the road */
  private showArrows: boolean = true;
  /** Default fill color for the road surface (dark asphalt) */
  private fillColor: Color = new Color(0x222021);

  /**
   * Creates a new Road segment between two nodes.
   *
   * @param n1 - Starting node of the road
   * @param n2 - Ending node of the road
   * @param laneCount - Number of lanes (default: 2)
   * @param isDirected - If true, road is one-way from n1 to n2 (default: false)
   * @param roadType - OSM road classification (default: "unclassified")
   */
  constructor(
    n1: Node,
    n2: Node,
    laneCount: number = 2,
    isDirected: boolean = false,
    roadType: string = "unclassified",
  ) {
    // Use global road dimensions from environment config
    const width = ROAD_WIDTH;
    const roundness = ROAD_ROUNDNESS;

    // Create the underlying edge (skeleton) that defines the road's path
    const skeleton = new Edge(n1, n2, isDirected);
    // Initialize parent Envelope with skeleton and dimensions
    super(skeleton, width, roundness);

    // Ensure at least 1 lane
    this.laneCount = Math.max(1, laneCount);
    this.roadType = roadType;
    this.width = width;
    this.roundness = roundness;
  }

  /**
   * Gets the starting node of the road.
   */
  get n1(): Node {
    return this.skeleton.n1;
  }

  /**
   * Gets the ending node of the road.
   */
  get n2(): Node {
    return this.skeleton.n2;
  }

  /**
   * Gets whether this road is one-way (directed).
   */
  get isDirected(): boolean {
    return this.skeleton.isDirected;
  }

  /**
   * Sets whether this road is one-way (directed).
   */
  set isDirected(val: boolean) {
    this.skeleton.isDirected = val;
  }

  /**
   * Calculates the length of this road segment.
   * @returns Distance between n1 and n2 in world units
   */
  length(): number {
    return this.skeleton.length();
  }

  /**
   * Renders the road into a Three.js group.
   *
   * Creates and caches three mesh layers:
   * 1. Base mesh (solid road surface)
   * 2. Lane mesh (dashed divider lines)
   * 3. Arrow mesh (directional indicators, if enabled)
   *
   * Meshes are only created once and reused on subsequent calls.
   * Call {@link regenerate} to force mesh recreation after geometry changes.
   *
   * @param group - Three.js group to add the road meshes to
   * @param config - Optional rendering configuration
   * @param config.fillColor - Override color for the road surface
   * @param config.showArrows - Whether to display directional arrows
   */
  draw(group: Group, config?: { fillColor?: Color; showArrows?: boolean }) {
    // Create base mesh on first draw (lazy initialization)
    if (!this.baseMesh) {
      this.baseMesh = this.createBaseMesh(config?.fillColor ?? this.fillColor);
    }
    // Add to group if not already present
    if (!group.children.includes(this.baseMesh)) {
      group.add(this.baseMesh);
    }

    // Create lane divider mesh on first draw
    if (!this.laneMesh) {
      this.laneMesh = this.createLaneMesh();
    }
    if (!group.children.includes(this.laneMesh)) {
      group.add(this.laneMesh);
    }

    // Create arrow mesh on first draw (if arrows are enabled)
    if (this.showArrows && !this.arrowMesh) {
      this.arrowMesh = this.createArrowMesh();
    }
    if (this.arrowMesh && !group.children.includes(this.arrowMesh)) {
      group.add(this.arrowMesh);
    }
  }

  /**
   * Releases all Three.js resources (geometries, materials, textures).
   *
   * Should be called when the road is removed from the world to prevent
   * memory leaks. After calling dispose(), the road can still be redrawn
   * (meshes will be recreated).
   */
  dispose(): void {
    // Dispose lane mesh and its resources
    if (this.laneMesh) {
      this.laneMesh.geometry.dispose();
      const mat = this.laneMesh.material as MeshBasicMaterial;
      mat.map?.dispose(); // Dispose the lane texture
      mat.dispose();
      this.laneMesh = null;
    }

    // Dispose arrow mesh and its resources
    if (this.arrowMesh) {
      this.arrowMesh.geometry.dispose();
      const mat = this.arrowMesh.material as MeshBasicMaterial;
      mat.map?.dispose(); // Dispose the arrow texture
      mat.dispose();
      this.arrowMesh = null;
    }

    // Dispose base mesh
    if (this.baseMesh) {
      this.baseMesh.geometry.dispose();
      (this.baseMesh.material as MeshBasicMaterial).dispose();
      this.baseMesh = null;
    }
  }

  /**
   * Regenerates the road polygon and clears cached meshes.
   *
   * Call this method after modifying road geometry (e.g., moving nodes)
   * to update the visual representation.
   */
  regenerate() {
    // Recreate the polygon with current dimensions
    this.poly = this.createPoly(this.width, this.roundness);
    // Clear cached meshes so they're recreated on next draw
    this.dispose();
  }

  /**
   * Serializes the road to a JSON object for saving.
   * @returns JSON representation including envelope data, lane count, and road type
   */
  toJson(): RoadJson {
    return {
      ...super.toJson(),
      laneCount: this.laneCount,
      roadType: this.roadType,
    };
  }

  /**
   * Restores the road state from a JSON object.
   * @param json - Previously serialized road data
   */
  fromJson(json: RoadJson): void {
    // Restore skeleton geometry
    if (json.skeleton) {
      this.skeleton.fromJson(json.skeleton);
    }

    // Restore road properties with defaults
    this.laneCount = json.laneCount ?? 2;
    this.roadType = json.roadType ?? "unclassified";

    // Rebuild geometry with restored data
    this.regenerate();
  }

  /**
   * Creates the solid road surface mesh.
   *
   * The base mesh is a filled polygon following the road envelope shape
   * (including rounded end caps). It's positioned slightly below Y=0
   * to ensure lane markings render on top.
   *
   * @param color - Fill color for the road surface
   * @returns A mesh representing the road's solid surface
   */
  private createBaseMesh(color: Color): Mesh {
    // Use BackSide rendering since the shape is viewed from above
    const material = new MeshBasicMaterial({
      color,
      side: BackSide,
    });

    // Convert the envelope polygon to a Three.js Shape
    const shape = new Shape();
    const nodes = this.poly.nodes;
    if (nodes.length > 0) {
      // Start the shape path at the first node
      shape.moveTo(nodes[0].x, nodes[0].y);
      // Connect all subsequent nodes
      for (let i = 1; i < nodes.length; i++) {
        shape.lineTo(nodes[i].x, nodes[i].y);
      }
    }

    // Create geometry from the shape
    const geometry = new ShapeGeometry(shape);
    const mesh = new Mesh(geometry, material);

    // Rotate to lay flat on XZ plane (shape is defined in XY)
    mesh.rotation.x = Math.PI / 2;
    // Position slightly below origin so overlays render on top
    mesh.position.y = -0.02;

    return mesh;
  }

  /**
   * Creates the envelope polygon with rounded end caps.
   *
   * The polygon is constructed by sampling points along semicircles
   * at each endpoint of the road skeleton. This creates a "stadium"
   * or "discorectangle" shape.
   *
   * ```
   *      ╭─────────────────────────╮
   *   n1 │                         │ n2
   *      ╰─────────────────────────╯
   * ```
   *
   * @param width - Total width of the road
   * @param roundness - Number of segments for the semicircular caps
   * @returns A polygon representing the road envelope
   */
  private createPoly(width: number, roundness: number): Polygon {
    const { n1, n2 } = this.skeleton;
    // Half-width is the radius of the rounded caps
    const radius = width / 2;
    // Calculate the angle of the road direction (n1 → n2)
    const baseAngle = angle(subtract(n1, n2));
    // Angular step for sampling the semicircles
    const step = Math.PI / Math.max(1, roundness);
    const nodes: Node[] = [];

    // Generate semicircle around n1 (left side of road when facing n1→n2)
    // Samples from -90° to +90° relative to the road direction
    for (
      let t = baseAngle - Math.PI / 2;
      t <= baseAngle + Math.PI / 2 + step / 2;
      t += step
    ) {
      nodes.push(translate(n1, t, radius));
    }

    // Generate semicircle around n2 (right side, rotated 180°)
    // This completes the "stadium" shape
    for (
      let t = baseAngle - Math.PI / 2;
      t <= baseAngle + Math.PI / 2 + step / 2;
      t += step
    ) {
      nodes.push(translate(n2, Math.PI + t, radius));
    }

    return new Polygon(nodes);
  }

  /**
   * Creates the lane divider mesh with dashed white lines.
   *
   * The mesh is a textured plane that spans the road length.
   * The texture contains dashed lines that tile vertically,
   * creating continuous lane dividers.
   *
   * ## Mesh Positioning
   *
   * - Centered between n1 and n2
   * - Elevated to Y=0.03 (above base mesh)
   * - Rotated to align with road direction
   *
   * @returns A mesh with the lane divider texture
   */
  private createLaneMesh(): Mesh {
    const length = this.length();
    const { laneCount } = this;

    // Create a plane spanning the full road width and length
    const geometry = new PlaneGeometry(this.width, length);
    // Generate the lane divider texture (dashed lines between lanes)
    const texture = createLaneTexture(laneCount);

    // Tile the texture vertically based on road length
    // tileWorldSize determines the dash cycle length in world units
    const tileWorldSize = 8;
    texture.repeat.set(1, length / tileWorldSize);

    // Configure material for transparent overlay
    const material = new MeshBasicMaterial({
      map: texture,
      side: DoubleSide, // Visible from both above and below
      transparent: true, // Allow background to show through gaps
      depthWrite: false, // Prevent z-fighting with other overlays
    });

    const mesh = new Mesh(geometry, material);

    // Position at the midpoint of the road
    const { n1, n2 } = this;
    mesh.position.set((n1.x + n2.x) / 2, 0.03, (n1.y + n2.y) / 2);

    // Calculate road direction angle
    const roadAngle = Math.atan2(n2.y - n1.y, n2.x - n1.x);
    // Rotate plane to lie flat on XZ plane
    mesh.rotation.x = -Math.PI / 2;
    // Align texture "up" direction with road direction (n1 → n2)
    mesh.rotation.z = -roadAngle + Math.PI / 2;

    return mesh;
  }

  /**
   * Creates the directional arrow mesh.
   *
   * The mesh displays traffic flow direction using arrow symbols.
   * For two-way roads, arrows point in opposite directions on each
   * side. For one-way roads, all arrows point from n1 to n2.
   *
   * ## Rendering Details
   *
   * - Uses polygon offset to prevent z-fighting with lane mesh
   * - Returns null for roads too short to display arrows
   *
   * @returns A mesh with directional arrows, or null if road is too short
   */
  private createArrowMesh(): Mesh | null {
    const length = this.length();
    const isOneWay = this.isDirected;

    // Generate arrow texture (may return null for short roads)
    const texture = createArrowTexture(this.laneCount, isOneWay, length);

    if (!texture) {
      return null; // Road too short for arrows
    }

    // Calculate geometry dimensions based on arrow spacing
    const arrowSpacing = ARROW_SPACING;
    const numArrows = Math.max(1, Math.floor(length / arrowSpacing));
    const geometryHeight = numArrows * arrowSpacing;

    const geometry = new PlaneGeometry(this.width, geometryHeight);

    // Configure material for transparent overlay with z-fighting prevention
    const material = new MeshBasicMaterial({
      map: texture,
      side: DoubleSide,
      transparent: true,
      depthWrite: false,
      // Polygon offset pushes arrows slightly forward in depth buffer
      // This prevents flickering between arrow and lane meshes
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });

    const mesh = new Mesh(geometry, material);

    // Position at the midpoint of the road (same as lane mesh)
    const { n1, n2 } = this;
    mesh.position.set((n1.x + n2.x) / 2, 0.03, (n1.y + n2.y) / 2);

    // Align mesh with road direction
    const roadAngle = Math.atan2(n2.y - n1.y, n2.x - n1.x);
    // Lay flat on XZ plane
    mesh.rotation.x = -Math.PI / 2;
    // Rotate so texture "forward" aligns with n1 → n2
    mesh.rotation.z = -roadAngle + Math.PI / 2;

    return mesh;
  }
}
