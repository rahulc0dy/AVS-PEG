import {
  CanvasTexture,
  ClampToEdgeWrapping,
  RepeatWrapping,
  NearestFilter,
  TextureFilter,
} from "three";

export interface RoadTextureConfig {
  laneCount: number;
  isOneWay: boolean;
  roadLength: number;
  showArrows?: boolean;
}

/**
 * Creates a small repeating texture tile with dashed lane dividers.
 */
export function createLaneTexture(laneCount: number): CanvasTexture {
  const laneWidthPx = 32;
  const width = laneCount * laneWidthPx;
  const height = 64; // One dash + gap cycle

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, width, height);

  // Dashed lane dividers
  ctx.fillStyle = "#FFFFFF";
  const dividerW = 2;
  const dashLen = height / 2;

  for (let i = 1; i < laneCount; i++) {
    const x = i * laneWidthPx - dividerW / 2;
    ctx.fillRect(x, 0, dividerW, dashLen);
  }

  const texture = new CanvasTexture(canvas);
  texture.wrapS = ClampToEdgeWrapping;
  texture.wrapT = RepeatWrapping;
  texture.magFilter = NearestFilter;
  texture.minFilter = NearestFilter;
  texture.generateMipmaps = false;

  return texture;
}

/**
 * Creates a texture with direction arrows drawn on canvas.
 * Arrows are spaced along the road length, one per lane.
 */
export function createArrowTexture(
  laneCount: number,
  isDirected: boolean,
  roadLength: number,
): CanvasTexture {
  const laneWidthPx = 32;
  const width = laneCount * laneWidthPx;

  // Scale height based on road length (1 pixel per world unit, scaled)
  const arrowSpacing = 100; // world units between arrows
  const numArrows = Math.max(1, Math.floor(roadLength / arrowSpacing));
  const heightPerArrow = 128; // pixels per arrow segment
  const height = numArrows * heightPerArrow;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, width, height);

  // Draw arrows in each lane
  const arrowSize = 16;

  for (let arrowIdx = 0; arrowIdx < numArrows; arrowIdx++) {
    const centerY = (arrowIdx + 0.5) * heightPerArrow;

    for (let lane = 0; lane < laneCount; lane++) {
      const centerX = (lane + 0.5) * laneWidthPx;

      // Determine direction: for two-way, left half goes up, right half goes down
      // For one-way (directed), all go up (forward direction)
      const pointsUp = isDirected || lane < laneCount / 2;

      ctx.save();
      ctx.translate(centerX, centerY);
      if (!pointsUp) {
        ctx.rotate(Math.PI); // Flip 180 degrees for backward lanes
      }

      // Draw arrow shape
      ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
      ctx.beginPath();
      // Arrow pointing up (in local coords after rotation)
      ctx.moveTo(0, -arrowSize / 2); // tip
      ctx.lineTo(-arrowSize / 3, arrowSize / 4); // bottom left
      ctx.lineTo(-arrowSize / 6, arrowSize / 4);
      ctx.lineTo(-arrowSize / 6, arrowSize / 2); // stem bottom left
      ctx.lineTo(arrowSize / 6, arrowSize / 2); // stem bottom right
      ctx.lineTo(arrowSize / 6, arrowSize / 4);
      ctx.lineTo(arrowSize / 3, arrowSize / 4); // bottom right
      ctx.closePath();
      ctx.fill();

      ctx.restore();
    }
  }

  const texture = new CanvasTexture(canvas);
  texture.wrapS = ClampToEdgeWrapping;
  texture.wrapT = ClampToEdgeWrapping;
  texture.magFilter = NearestFilter;
  texture.minFilter = NearestFilter;
  texture.generateMipmaps = false;

  return texture;
}
