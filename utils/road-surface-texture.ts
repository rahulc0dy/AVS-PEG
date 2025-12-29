import { ARROW_SPACING } from "@/env";
import {
  CanvasTexture,
  ClampToEdgeWrapping,
  LinearFilter,
  LinearMipmapLinearFilter,
  NearestFilter,
  RepeatWrapping,
} from "three";

export interface RoadTextureConfig {
  laneCount: number;
  isOneWay: boolean;
  roadLength: number;
  showArrows?: boolean;
}

/**
 * Creates a repeating texture tile containing dashed white lane dividers for the specified number of lanes.
 *
 * @returns A CanvasTexture configured as a horizontal tile of dashed lane dividers suitable for repeating along a road surface
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
 * Create a texture containing directional arrows for each lane.
 *
 * Lanes are laid out on the texture X-axis with lane 0 at the left and lane N-1 at the right.
 * For one-way roads all lanes are drawn as forward. For two-way roads lanes with index < laneCount/2
 * are treated as forward and lanes with index >= laneCount/2 are treated as backward.
 * An upward-pointing arrow on the canvas denotes the forward direction; a downward-pointing arrow denotes the backward direction.
 *
 * @param laneCount - Number of lanes represented horizontally in the texture
 * @param isOneWay - When true all lanes are drawn as forward direction
 * @param roadLength - Road length in world units; if less than the minimum required length for arrows the function returns `null`
 * @returns A configured CanvasTexture with arrow graphics for each lane, or `null` if the road is too short to render arrows
 */
export function createArrowTexture(
  laneCount: number,
  isOneWay: boolean,
  roadLength: number,
): CanvasTexture | null {
  const laneWidthPx = 32;
  const width = laneCount * laneWidthPx;

  const arrowSpacing = ARROW_SPACING;
  const minLengthForArrows = 60; // minimum road length to show arrows

  if (roadLength < minLengthForArrows) {
    return null;
  }

  const numArrows = Math.max(1, Math.floor(roadLength / arrowSpacing));
  const heightPerArrowPx = laneWidthPx * 4;
  const height = numArrows * heightPerArrowPx;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, width, height);

  const arrowSize = laneWidthPx / 2;

  for (let arrowIdx = 0; arrowIdx < numArrows; arrowIdx++) {
    const centerY = (arrowIdx + 0.5) * heightPerArrowPx;

    for (let lane = 0; lane < laneCount; lane++) {
      const centerX = (lane + 0.5) * laneWidthPx;

      // Left-hand traffic (India):
      // - One-way: all lanes go forward
      // - Two-way: left half goes forward, right half goes backward
      const isForwardLane = isOneWay || lane < laneCount / 2;

      ctx.save();
      ctx.translate(centerX, centerY);

      if (!isForwardLane) {
        ctx.rotate(Math.PI); // Flip arrow for backward lanes
      }

      // Draw arrow pointing UP (forward)
      ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
      ctx.beginPath();
      ctx.moveTo(0, -arrowSize / 2); // tip
      ctx.lineTo(-arrowSize / 3, arrowSize / 4);
      ctx.lineTo(-arrowSize / 6, arrowSize / 4);
      ctx.lineTo(-arrowSize / 6, arrowSize / 2);
      ctx.lineTo(arrowSize / 6, arrowSize / 2);
      ctx.lineTo(arrowSize / 6, arrowSize / 4);
      ctx.lineTo(arrowSize / 3, arrowSize / 4);
      ctx.closePath();
      ctx.fill();

      ctx.restore();
    }
  }

  const texture = new CanvasTexture(canvas);
  texture.wrapS = ClampToEdgeWrapping;
  texture.wrapT = ClampToEdgeWrapping;
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.generateMipmaps = true;

  return texture;
}