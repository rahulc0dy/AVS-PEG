import { Edge } from "@/lib/primitives/edge";
import { Node } from "@/lib/primitives/node";
import { Envelope } from "@/lib/primitives/envelope";
import { RoadJson } from "@/types/save";
import {
  Color,
  FrontSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
} from "three";
import {
  createArrowTexture,
  createLaneTexture,
} from "@/utils/road-surface-texture";
import { ARROW_SPACING, ROAD_ROUNDNESS, ROAD_WIDTH } from "@/env";
import { angle } from "@/utils/math";

/**
 * Represents a road segment in the world, extending {@link Envelope} to provide
 * visual geometry with rounded end caps.
 *
 * A Road consists of three visual layers:
 * 1. **Base mesh**: The solid road surface (asphalt color)
 * 2. **Lane mesh**: Dashed lane divider lines
 * 3. **Arrow mesh**: Directional traffic flow arrows
 *
 * ### Coordinate System
 *
 * - Roads are defined by two endpoint nodes (`n1` and `n2`)
 * - The skeleton edge runs from `n1` to `n2`
 * - Lane directions are determined by the road's `isDirected` property
 *
 * ### Visual Layers (Y-axis stacking)
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

  /** Cached mesh for lane divider lines (dashed white lines) */
  private laneMesh: Mesh | null = null;
  /** Cached mesh for directional arrows */
  private arrowMesh: Mesh | null = null;
  /** Whether to display directional arrows on the road */
  private showArrows: boolean = true;
  /** Default fill color for the road surface (dark asphalt) */
  private fillColor: Color = new Color(0x222021);

  /**
   * Creates a new Road segment between two nodes.
   *
   * @param skeleton - Underlying edge (skeleton) that defines the road's path
   * @param laneCount - Number of lanes (default: 2)
   * @param roadType - OSM road classification (default: "unclassified")
   */
  constructor(
    skeleton: Edge,
    laneCount: number = 2,
    roadType: string = "unclassified",
  ) {
    // Initialize parent Envelope with skeleton and dimensions
    super(skeleton, ROAD_WIDTH, ROAD_ROUNDNESS);

    // Ensure at least 1 lane
    this.laneCount = Math.max(1, laneCount);
    this.roadType = roadType;
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
   * Calculates the length of this road segment.
   * @returns Distance between n1 and n2 in world units
   */
  length(): number {
    return this.skeleton.length();
  }

  /**
   * Regenerates the road polygon and clears cached meshes.
   *
   * Call this method after modifying road geometry (e.g., moving nodes)
   * to update the visual representation.
   */
  regenerate() {
    // Recreate the polygon with current dimensions
    this.poly = this.generatePolygon(ROAD_WIDTH, ROAD_ROUNDNESS);
    // Clear cached meshes so they're recreated on next draw
    this.dispose();
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
    super.draw(group, { fillColor: config?.fillColor ?? this.fillColor });

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
    super.dispose();

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
    super.fromJson(json);

    // Restore road properties with defaults
    this.laneCount = json.laneCount ?? 2;
    this.roadType = json.roadType ?? "unclassified";

    // Rebuild geometry with restored data
    this.regenerate();
  }

  /**
   * Creates the lane divider mesh with dashed white lines.
   *
   * The mesh is a textured plane that spans the road length.
   * The texture contains dashed lines that tile vertically,
   * creating continuous lane dividers.
   *
   * ### Mesh Positioning
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
    const geometry = new PlaneGeometry(ROAD_WIDTH, length);
    // Generate the lane divider texture (dashed lines between lanes)
    const texture = createLaneTexture(laneCount);

    // Tile the texture vertically based on road length
    // tileWorldSize determines the dash cycle length in world units
    const tileWorldSize = 8;
    texture.repeat.set(1, length / tileWorldSize);

    // Configure material for transparent overlay
    const material = new MeshBasicMaterial({
      map: texture,
      side: FrontSide, // Visible from above only
      transparent: true, // Allow background to show through gaps
      depthWrite: false, // Prevent z-fighting with other overlays
    });

    return this.createOverlayMesh(geometry, material);
  }

  /**
   * Creates the directional arrow mesh.
   *
   * The mesh displays traffic flow direction using arrow symbols.
   * For two-way roads, arrows point in opposite directions on each
   * side. For one-way roads, all arrows point from n1 to n2.
   *
   * ### Rendering Details
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

    const geometry = new PlaneGeometry(ROAD_WIDTH, geometryHeight);

    // Configure material for transparent overlay with z-fighting prevention
    const material = new MeshBasicMaterial({
      map: texture,
      side: FrontSide,
      transparent: true,
      depthWrite: false,
      // Polygon offset pushes arrows slightly forward in depth buffer
      // This prevents flickering between arrow and lane meshes
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });

    return this.createOverlayMesh(geometry, material);
  }

  /**
   * Creates a road overlay mesh (lane markings, arrows), positions it at the road midpoint
   * and rotates it to align with the road direction (n1 → n2).
   */
  private createOverlayMesh(
    geometry: PlaneGeometry,
    material: MeshBasicMaterial,
  ): Mesh {
    const mesh = new Mesh(geometry, material);
    const { n1, n2 } = this;

    // Position at the midpoint of the road
    mesh.position.set((n1.x + n2.x) / 2, 0.03, (n1.y + n2.y) / 2);

    // Align mesh with road direction
    const roadAngle = angle(this.skeleton.directionVector());
    // Lay flat on XZ plane
    mesh.rotation.x = -Math.PI / 2;
    // Rotate so texture "forward" aligns with n1 → n2
    mesh.rotation.z = -roadAngle - Math.PI / 2;

    return mesh;
  }
}
