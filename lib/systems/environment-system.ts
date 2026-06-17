import { Node } from "@/lib/primitives/node";
import { Road } from "@/lib/world/road";
import { distance, getRandomNumberBetween } from "@/utils/math";
import {
  BufferGeometry,
  Color,
  FrontSide,
  Group,
  InstancedMesh,
  Material,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
} from "three";
import { GLTFLoader } from "three/examples/jsm/Addons.js";

/**
 * Configuration for a single procedural environment asset type.
 */
interface EnvironmentAssetConfig {
  /** GLTF model URL in `/public/models`. */
  modelUrl: string;
  /** Approximate spawn density (instances per world unit of road length). */
  densityPerRoadUnit: number;
  /** Lower bound for generated instance count. */
  minCount: number;
  /** Upper bound for generated instance count. */
  maxCount: number;
  /** Minimum distance from the nearest road center line. */
  minRoadDistance: number;
  /** Maximum distance from the nearest road center line. */
  maxRoadDistance: number;
  /** Minimum random scale for this asset. */
  minScale: number;
  /** Maximum random scale for this asset. */
  maxScale: number;
  /** Minimum spacing radius to avoid heavy overlap with other assets. */
  minSpacing: number;
  /** Random lateral jitter along road direction while spawning. */
  alongRoadJitter: number;
  /** Vertical placement offset in world coordinates. */
  yOffset: number;
}

/**
 * Placement data for one generated instance.
 */
interface EnvironmentPlacement {
  position: Node;
  rotationY: number;
  scale: number;
}

/**
 * Occupancy marker used to keep generated assets from colliding too tightly.
 */
interface OccupiedArea {
  position: Node;
  radius: number;
}

/**
 * Extracted renderable piece from a GLTF model.
 */
interface ModelPart {
  geometry: BufferGeometry;
  material: Material;
  localMatrix: Matrix4;
}

/**
 * 2D axis-aligned world bounds used to clamp generated placements.
 */
interface WorldBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

/**
 * Procedural environment generation presets.
 *
 * The defaults are intentionally conservative so generation remains performant
 * while still producing enough variation to make the world feel populated.
 */
const ENVIRONMENT_ASSETS: EnvironmentAssetConfig[] = [
  {
    modelUrl: "/models/tree_small.gltf",
    densityPerRoadUnit: 0.05,
    minCount: 45,
    maxCount: 420,
    minRoadDistance: 35,
    maxRoadDistance: 120,
    minScale: 0.85,
    maxScale: 1.35,
    minSpacing: 14,
    alongRoadJitter: 60,
    yOffset: 0,
  },
  {
    modelUrl: "/models/tree_big.gltf",
    densityPerRoadUnit: 0.03,
    minCount: 20,
    maxCount: 220,
    minRoadDistance: 40,
    maxRoadDistance: 140,
    minScale: 0.95,
    maxScale: 1.45,
    minSpacing: 20,
    alongRoadJitter: 80,
    yOffset: 0,
  },
  {
    modelUrl: "/models/stone.gltf",
    densityPerRoadUnit: 0.01,
    minCount: 24,
    maxCount: 190,
    minRoadDistance: 30,
    maxRoadDistance: 100,
    minScale: 0.65,
    maxScale: 1.2,
    minSpacing: 8,
    alongRoadJitter: 40,
    yOffset: 0,
  },
  {
    modelUrl: "/models/house_1.gltf",
    densityPerRoadUnit: 0.005,
    minCount: 5,
    maxCount: 30,
    minRoadDistance: 55,
    maxRoadDistance: 180,
    minScale: 1.05,
    maxScale: 1.65,
    minSpacing: 45,
    alongRoadJitter: 10,
    yOffset: 0,
  },
  {
    modelUrl: "/models/house_2.gltf",
    densityPerRoadUnit: 0.005,
    minCount: 5,
    maxCount: 30,
    minRoadDistance: 55,
    maxRoadDistance: 180,
    minScale: 1.0,
    maxScale: 1.6,
    minSpacing: 45,
    alongRoadJitter: 10,
    yOffset: 0,
  },
  {
    modelUrl: "/models/building_residential.gltf",
    densityPerRoadUnit: 0.15,
    minCount: 20,
    maxCount: 900,
    minRoadDistance: 60,
    maxRoadDistance: 200,
    minScale: 1.15,
    maxScale: 1.8,
    minSpacing: 50,
    alongRoadJitter: 10,
    yOffset: 0,
  },
  {
    modelUrl: "/models/big_building.gltf",
    densityPerRoadUnit: 0.1,
    minCount: 20,
    maxCount: 600,
    minRoadDistance: 65,
    maxRoadDistance: 220,
    minScale: 0.95,
    maxScale: 1.35,
    minSpacing: 55,
    alongRoadJitter: 10,
    yOffset: 0,
  },
];

/**
 * Generates and manages procedural static scenery around roads.
 *
 * The system keeps a dedicated environment group containing instanced meshes
 * (trees, stones, buildings). Generation is road-aware:
 * - It samples placements around road center lines.
 * - Rejects points on top of roads.
 * - Applies simple spacing rules so assets do not heavily overlap.
 */
export class EnvironmentSystem {
  private readonly worldGroup: Group;
  private roads: Road[];

  private readonly environmentGroup: Group = new Group();
  private readonly loader: GLTFLoader = new GLTFLoader();
  private readonly modelCache = new Map<string, Promise<ModelPart[]>>();
  private readonly activeMeshes: InstancedMesh<BufferGeometry, Material>[] = [];

  private readonly dummy: Object3D = new Object3D();
  private readonly tempMatrix: Matrix4 = new Matrix4();

  private groundMesh: Mesh | null = null;

  private generationToken = 0;
  private totalRoadLength = 0;

  /**
   * Create a new environment system.
   *
   * @param worldGroup - Parent group used by the world renderer.
   * @param roads - Initial roads to generate around.
   */
  constructor(worldGroup: Group, roads: Road[]) {
    this.worldGroup = worldGroup;
    this.roads = roads;
    this.environmentGroup.name = "environment-group";
  }

  /**
   * Update roads reference after world regeneration/loading.
   *
   * @param roads - Latest road list.
   */
  public setRoads(roads: Road[]): void {
    this.roads = roads;
  }

  /**
   * Regenerate all procedural environment instances from current roads.
   *
   * This method is safe to call repeatedly; newer generations invalidate
   * previous async runs so stale model loads do not overwrite latest output.
   */
  public async regenerate(): Promise<void> {
    const generationToken = ++this.generationToken;
    this.clearInstancedMeshes();

    if (this.roads.length === 0) {
      return;
    }

    this.totalRoadLength = 0;
    for (const road of this.roads) {
      this.totalRoadLength += road.length();
    }

    const maxRoadDistance = Math.max(
      ...ENVIRONMENT_ASSETS.map((asset) => asset.maxRoadDistance),
    );
    const worldBounds = this.getWorldBounds(maxRoadDistance);

    this.createGround(worldBounds);

    const occupiedAreas: OccupiedArea[] = [];
    const sortedAssets = [...ENVIRONMENT_ASSETS].reverse();

    for (const asset of sortedAssets) {
      const assetCount = this.resolveAssetCount(asset, this.totalRoadLength);
      const placements = await this.generatePlacements(
        asset,
        assetCount,
        worldBounds,
        occupiedAreas,
        generationToken,
      );

      if (generationToken !== this.generationToken) {
        return;
      }

      if (placements.length === 0) {
        continue;
      }

      const modelParts = await this.getModelParts(asset.modelUrl);
      if (generationToken !== this.generationToken) {
        return;
      }

      this.createInstancedMeshes(modelParts, placements, asset.yOffset);
    }

    this.draw();
  }

  /**
   * Attach generated environment meshes to the world group.
   *
   * Call this during world draw after `worldGroup.clear()`.
   */
  public draw(): void {
    if (this.environmentGroup.children.length === 0) {
      return;
    }
    if (!this.worldGroup.children.includes(this.environmentGroup)) {
      this.worldGroup.add(this.environmentGroup);
    }
  }

  /**
   * Dispose all generated meshes and cached model resources.
   *
   * This is used on full world disposal and world reload.
   */
  public dispose(): void {
    this.generationToken += 1;
    this.clearInstancedMeshes();

    if (this.groundMesh) {
      if (this.groundMesh.parent)
        this.groundMesh.parent.remove(this.groundMesh);
      this.groundMesh.geometry.dispose();
      (this.groundMesh.material as Material).dispose();
      this.groundMesh = null;
    }

    if (this.environmentGroup.parent) {
      this.environmentGroup.parent.remove(this.environmentGroup);
    }

    for (const promise of this.modelCache.values()) {
      promise
        .then((modelParts) => {
          for (const part of modelParts) {
            part.geometry.dispose();
            part.material.dispose();
          }
        })
        .catch(() => {});
    }
    this.modelCache.clear();
  }

  /**
   * Creates a textured/colored ground plane based on the generated bounds.
   */
  private createGround(bounds: WorldBounds): void {
    if (this.groundMesh) {
      if (this.groundMesh.parent) {
        this.groundMesh.parent.remove(this.groundMesh);
      }
      this.groundMesh.geometry.dispose();
      (this.groundMesh.material as Material).dispose();
      this.groundMesh = null;
    }

    const width = bounds.maxX - bounds.minX;
    const height = bounds.maxY - bounds.minY;
    if (width <= 0 || height <= 0) return;

    const geometry = new PlaneGeometry(width, height);
    const material = new MeshStandardMaterial({
      color: new Color(0x3a5a40), // Ground / green tint
      side: FrontSide,
      roughness: 0.8,
      metalness: 0.2,
    });

    this.groundMesh = new Mesh(geometry, material);

    this.groundMesh.rotation.x = -Math.PI / 2; // Flat on XZ plane
    this.groundMesh.position.set(
      bounds.minX + width / 2,
      -0.1, // slightly below zero to avoid z-fighting with roads
      bounds.minY + height / 2,
    );

    this.environmentGroup.add(this.groundMesh);
  }

  /**
   * Resolve dynamic spawn count from road length and asset density.
   */
  private resolveAssetCount(
    asset: EnvironmentAssetConfig,
    totalRoadLength: number,
  ): number {
    const estimated = Math.round(totalRoadLength * asset.densityPerRoadUnit);
    return Math.max(asset.minCount, Math.min(asset.maxCount, estimated));
  }

  /**
   * Generate placements for one asset while respecting roads and occupancy.
   */
  private async generatePlacements(
    asset: EnvironmentAssetConfig,
    count: number,
    bounds: WorldBounds,
    occupiedAreas: OccupiedArea[],
    generationToken: number,
  ): Promise<EnvironmentPlacement[]> {
    const placements: EnvironmentPlacement[] = [];
    let iterationsSinceYield = 0;

    const spacing = asset.minSpacing;
    const roadDistance = asset.minRoadDistance;

    for (const road of this.roads) {
      if (placements.length >= count) break;

      const dx = road.n2.x - road.n1.x;
      const dy = road.n2.y - road.n1.y;
      const len = Math.hypot(dx, dy);
      if (len === 0) continue;

      const dirX = dx / len;
      const dirY = dy / len;
      const perpX = -dirY;

      // Step along the road length
      for (let d = spacing / 2; d < len; d += spacing) {
        if (placements.length >= count) break;

        iterationsSinceYield++;
        if (iterationsSinceYield > 50) {
          await new Promise((resolve) => setTimeout(resolve, 0));
          iterationsSinceYield = 0;

          if (generationToken !== this.generationToken) {
            return [];
          }
        }

        const baseX = road.n1.x + dirX * d;
        const baseY = road.n1.y + dirY * d;

        // Try both sides of the road
        for (const side of [-1, 1]) {
          if (placements.length >= count) break;

          const alongOffset = getRandomNumberBetween(
            -asset.alongRoadJitter,
            asset.alongRoadJitter,
          );
          const distanceOffset = getRandomNumberBetween(
            0,
            (asset.maxRoadDistance - asset.minRoadDistance) * 0.3,
          );
          const actualDist = roadDistance + distanceOffset;

          const pos = new Node(
            baseX + perpX * actualDist * side + dirX * alongOffset,
            baseY + dirX * actualDist * side + dirY * alongOffset,
          );

          if (!this.isInsideBounds(pos, bounds)) continue;
          if (this.isOnRoad(pos)) continue;
          if (this.getNearestRoadDistance(pos) < asset.minRoadDistance)
            continue;

          const scale = getRandomNumberBetween(asset.minScale, asset.maxScale);
          const occupiedRadius = asset.minSpacing * scale;

          const intersectsOccupied = occupiedAreas.some(
            (occupiedArea) =>
              distance(occupiedArea.position, pos) <
              occupiedArea.radius + occupiedRadius,
          );

          if (intersectsOccupied) continue;

          let rotationY = getRandomNumberBetween(0, Math.PI * 2);
          if (
            asset.modelUrl.includes("house") ||
            asset.modelUrl.includes("building")
          ) {
            const roadAngle = Math.atan2(dirX, dirY);
            rotationY = roadAngle + (side === 1 ? -Math.PI / 2 : Math.PI / 2);
          }

          placements.push({ position: pos, rotationY, scale });
          occupiedAreas.push({
            position: pos,
            radius: occupiedRadius,
          });
        }
      }
    }

    return placements;
  }

  /**
   * Build/refresh instanced meshes for one model asset.
   */
  private createInstancedMeshes(
    modelParts: ModelPart[],
    placements: EnvironmentPlacement[],
    yOffset: number,
  ): void {
    for (const part of modelParts) {
      const instancedMesh = new InstancedMesh(
        part.geometry,
        part.material,
        placements.length,
      );

      for (const [index, placement] of placements.entries()) {
        this.dummy.position.set(
          placement.position.x,
          yOffset,
          placement.position.y,
        );
        this.dummy.rotation.set(0, placement.rotationY, 0);
        this.dummy.scale.set(placement.scale, placement.scale, placement.scale);
        this.dummy.updateMatrix();

        this.tempMatrix.multiplyMatrices(this.dummy.matrix, part.localMatrix);
        instancedMesh.setMatrixAt(index, this.tempMatrix);
      }

      instancedMesh.instanceMatrix.needsUpdate = true;
      instancedMesh.computeBoundingSphere();

      this.environmentGroup.add(instancedMesh);
      this.activeMeshes.push(instancedMesh);
    }
  }

  /**
   * Load and cache model mesh parts for instancing.
   */
  private getModelParts(modelUrl: string): Promise<ModelPart[]> {
    const cached = this.modelCache.get(modelUrl);
    if (cached) {
      return cached;
    }

    const loadPromise = (async () => {
      const gltf = await this.loader.loadAsync(modelUrl);
      gltf.scene.updateMatrixWorld(true);
      const rootInverseMatrix = gltf.scene.matrixWorld.clone().invert();
      const modelParts: ModelPart[] = [];

      gltf.scene.traverse((child: Object3D) => {
        const mesh = child as Mesh;
        if (!mesh.isMesh) {
          return;
        }

        const material = Array.isArray(mesh.material)
          ? mesh.material[0]
          : mesh.material;
        if (!material) {
          return;
        }

        mesh.updateMatrixWorld(true);
        const localMatrix = rootInverseMatrix
          .clone()
          .multiply(mesh.matrixWorld);

        modelParts.push({
          geometry: mesh.geometry.clone(),
          material: material.clone(),
          localMatrix,
        });
      });

      this.disposeLoadedScene(gltf.scene);

      if (modelParts.length === 0) {
        throw new Error(
          `Environment model "${modelUrl}" has no mesh geometry.`,
        );
      }

      return modelParts;
    })();

    this.modelCache.set(modelUrl, loadPromise);
    return loadPromise;
  }

  /**
   * Dispose the original loaded GLTF scene resources after cloning required data.
   */
  private disposeLoadedScene(scene: Object3D): void {
    const geometries = new Set<BufferGeometry>();
    const materials = new Set<Material>();

    scene.traverse((child: Object3D) => {
      const mesh = child as Mesh;
      if (!mesh.isMesh) {
        return;
      }
      geometries.add(mesh.geometry);

      const meshMaterials = Array.isArray(mesh.material)
        ? mesh.material
        : [mesh.material];

      for (const material of meshMaterials) {
        materials.add(material);
      }
    });

    for (const geometry of geometries) {
      geometry.dispose();
    }
    for (const material of materials) {
      material.dispose();
    }
  }

  /**
   * Remove and dispose all currently active instanced meshes.
   */
  private clearInstancedMeshes(): void {
    for (const mesh of this.activeMeshes) {
      if (mesh.parent) {
        mesh.parent.remove(mesh);
      }
      mesh.dispose();
    }
    this.activeMeshes.length = 0;
    this.environmentGroup.clear();
  }

  /**
   * Compute expanded world bounds from current road polygons.
   */
  private getWorldBounds(padding: number): WorldBounds {
    let minX = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;

    for (const road of this.roads) {
      const bounds = road.poly.getBoundingBox();
      minX = Math.min(minX, bounds.minX);
      maxX = Math.max(maxX, bounds.maxX);
      minY = Math.min(minY, bounds.minY);
      maxY = Math.max(maxY, bounds.maxY);
    }

    if (
      !Number.isFinite(minX) ||
      !Number.isFinite(maxX) ||
      !Number.isFinite(minY) ||
      !Number.isFinite(maxY)
    ) {
      return {
        minX: -padding,
        maxX: padding,
        minY: -padding,
        maxY: padding,
      };
    }

    return {
      minX: minX - padding,
      maxX: maxX + padding,
      minY: minY - padding,
      maxY: maxY + padding,
    };
  }

  /**
   * Determine the closest center-line distance from a point to any road.
   */
  private getNearestRoadDistance(node: Node): number {
    let nearestDistance = Number.POSITIVE_INFINITY;
    for (const road of this.roads) {
      nearestDistance = Math.min(
        nearestDistance,
        road.skeleton.distanceToNode(node),
      );
    }
    return nearestDistance;
  }

  /**
   * Check if a point is placed on any road polygon.
   */
  private isOnRoad(node: Node): boolean {
    return this.roads.some((road) => road.poly.containsNode(node));
  }

  /**
   * Check if a point falls inside supplied world bounds.
   */
  private isInsideBounds(node: Node, bounds: WorldBounds): boolean {
    return (
      node.x >= bounds.minX &&
      node.x <= bounds.maxX &&
      node.y >= bounds.minY &&
      node.y <= bounds.maxY
    );
  }
}
