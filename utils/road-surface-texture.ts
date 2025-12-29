import { ARROW_SPACING } from "@/env";
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
 *
 * Left-hand traffic (India, UK, etc.):
 * - Texture X-axis: lane 0 on left, lane N-1 on right
 * - Two-way roads: left lanes (low index) = forward, right lanes (high index) = backward
 * - One-way roads: all lanes = forward
 *
 * Arrow pointing UP in canvas = forward direction (n1 → n2)
 * Arrow pointing DOWN in canvas = backward direction (n2 → n1)
 *
 * @param laneCount - number of lanes
 * @param isOneWay - true for one-way roads (all lanes go forward)
 * @param roadLength - length of the road in world units
 * @returns CanvasTexture with arrows, or null if road is too short
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
  const heightPerArrowPx = 128;
  const height = numArrows * heightPerArrowPx;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, width, height);

  const arrowSize = 16;

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
  texture.magFilter = NearestFilter;
  texture.minFilter = NearestFilter;
  texture.generateMipmaps = false;

  return texture;
}
