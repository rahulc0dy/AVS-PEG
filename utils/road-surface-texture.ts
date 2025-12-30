import { ARROW_SPACING } from "@/env";
import {
  CanvasTexture,
  ClampToEdgeWrapping,
  LinearFilter,
  LinearMipmapLinearFilter,
  NearestFilter,
  RepeatWrapping,
} from "three";

/**
 * Configuration options for road texture generation.
 */
export interface RoadTextureConfig {
  /** Number of lanes on the road */
  laneCount: number;
  /** Whether the road is one-way (all lanes go same direction) */
  isOneWay: boolean;
  /** Length of the road in world units */
  roadLength: number;
  /** Whether to show directional arrows on the road surface */
  showArrows?: boolean;
}

/**
 * Creates a small repeating texture tile with dashed lane dividers.
 *
 * The texture is designed to tile vertically along the road's length,
 * creating continuous dashed lines between lanes. Each dash cycle
 * consists of a filled portion and a gap.
 *
 * Texture layout:
 * - Width: `laneCount * 32px` (32px per lane)
 * - Height: 64px (one complete dash + gap cycle)
 * - Dividers are drawn at lane boundaries (between lanes, not at edges)
 *
 * @param laneCount - Number of lanes on the road (minimum 1)
 * @returns A CanvasTexture configured for vertical tiling
 *
 * @example
 * ```ts
 * const texture = createLaneTexture(3);
 * // Creates texture with 2 divider lines (between lanes 0-1 and 1-2)
 * ```
 */
export function createLaneTexture(laneCount: number): CanvasTexture {
  // Each lane is 32 pixels wide in the texture
  const laneWidthPx = 32;
  const width = laneCount * laneWidthPx;
  // Height represents one complete dash cycle (dash + gap)
  const height = 64;

  // Create an off-screen canvas for texture generation
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d")!;
  // Start with a transparent background
  ctx.clearRect(0, 0, width, height);

  // Draw white dashed lane dividers
  ctx.fillStyle = "#FFFFFF";
  const dividerW = 2; // Width of each divider line in pixels
  const dashLen = height / 2; // Dash occupies half the tile height (50% duty cycle)

  // Draw dividers between lanes (not at the edges)
  // For n lanes, there are (n-1) dividers
  for (let i = 1; i < laneCount; i++) {
    // Center the divider line on the lane boundary
    const x = i * laneWidthPx - dividerW / 2;
    // Draw dash in the top half of the tile (gap will be in bottom half due to tiling)
    ctx.fillRect(x, 0, dividerW, dashLen);
  }

  // Create Three.js texture from the canvas
  const texture = new CanvasTexture(canvas);
  // Clamp horizontally (no repeat across road width)
  texture.wrapS = ClampToEdgeWrapping;
  // Repeat vertically along the road length for continuous dashed lines
  texture.wrapT = RepeatWrapping;
  // Use nearest-neighbor filtering for crisp pixel edges
  texture.magFilter = NearestFilter;
  texture.minFilter = NearestFilter;
  // Disable mipmaps to keep sharp edges at all zoom levels
  texture.generateMipmaps = false;

  return texture;
}

/**
 * Creates a texture with direction arrows drawn on canvas.
 *
 * This function generates a road surface texture showing traffic flow direction
 * using arrow symbols. The arrows are positioned in the center of each lane
 * and spaced evenly along the road length.
 *
 * ## Traffic Convention (Left-hand traffic - India, UK, etc.)
 *
 * - **Texture X-axis**: Lane 0 on left, lane N-1 on right
 * - **Two-way roads**: Left lanes (lower index) = forward, right lanes (higher index) = backward
 * - **One-way roads**: All lanes point forward
 *
 * ## Arrow Direction Mapping
 *
 * - Arrow pointing **UP** in canvas = forward direction (n1 → n2)
 * - Arrow pointing **DOWN** in canvas = backward direction (n2 → n1)
 *
 * @param laneCount - Number of lanes on the road
 * @param isOneWay - If true, all lanes show forward arrows; if false, lanes are split by direction
 * @param roadLength - Length of the road in world units (used to calculate number of arrows)
 * @returns A CanvasTexture with directional arrows, or `null` if the road is too short for arrows
 *
 * @example
 * ```ts
 * // Two-way road with 4 lanes (2 forward, 2 backward)
 * const texture = createArrowTexture(4, false, 200);
 *
 * // One-way road with 2 lanes (both forward)
 * const texture = createArrowTexture(2, true, 150);
 * ```
 */
export function createArrowTexture(
  laneCount: number,
  isOneWay: boolean,
  roadLength: number,
): CanvasTexture | null {
  // Each lane is 32 pixels wide in the texture
  const laneWidthPx = 32;
  const width = laneCount * laneWidthPx;

  // Use configured arrow spacing from environment
  const arrowSpacing = ARROW_SPACING;
  // Minimum road length required to display any arrows
  const minLengthForArrows = 60;

  // Skip arrow generation for very short road segments
  if (roadLength < minLengthForArrows) {
    return null;
  }

  // Calculate how many arrow rows fit along the road length
  const numArrows = Math.max(1, Math.floor(roadLength / arrowSpacing));
  // Each arrow row occupies 4x the lane width in pixels (maintains aspect ratio)
  const heightPerArrowPx = laneWidthPx * 4;
  const height = numArrows * heightPerArrowPx;

  // Create an off-screen canvas for texture generation
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d")!;
  // Start with a transparent background
  ctx.clearRect(0, 0, width, height);

  // Arrow size is half the lane width for good visual proportions
  const arrowSize = laneWidthPx / 2;

  // Draw arrows for each row along the road length
  for (let arrowIdx = 0; arrowIdx < numArrows; arrowIdx++) {
    // Center each arrow vertically within its row
    const centerY = (arrowIdx + 0.5) * heightPerArrowPx;

    // Draw one arrow per lane
    for (let lane = 0; lane < laneCount; lane++) {
      // Center the arrow horizontally within the lane
      const centerX = (lane + 0.5) * laneWidthPx;

      // Determine arrow direction based on traffic rules:
      // Left-hand traffic (India, UK): left lanes go forward, right lanes go backward
      // One-way roads: all lanes go forward
      const isForwardLane = isOneWay || lane < laneCount / 2;

      // Save canvas state before transformations
      ctx.save();
      // Move origin to arrow center for easier rotation
      ctx.translate(centerX, centerY);

      // Rotate 180° for backward-facing arrows
      if (!isForwardLane) {
        ctx.rotate(Math.PI);
      }

      // Draw arrow shape pointing UP (forward direction)
      // Arrow shape: triangular head with rectangular stem
      ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
      ctx.beginPath();
      ctx.moveTo(0, -arrowSize / 2); // Arrow tip (top)
      ctx.lineTo(-arrowSize / 3, arrowSize / 4); // Left shoulder
      ctx.lineTo(-arrowSize / 6, arrowSize / 4); // Left stem top
      ctx.lineTo(-arrowSize / 6, arrowSize / 2); // Left stem bottom
      ctx.lineTo(arrowSize / 6, arrowSize / 2); // Right stem bottom
      ctx.lineTo(arrowSize / 6, arrowSize / 4); // Right stem top
      ctx.lineTo(arrowSize / 3, arrowSize / 4); // Right shoulder
      ctx.closePath();
      ctx.fill();

      // Restore canvas state (removes translation/rotation)
      ctx.restore();
    }
  }

  // Create Three.js texture from the canvas
  const texture = new CanvasTexture(canvas);
  // Clamp in both directions (no tiling - texture spans full road)
  texture.wrapS = ClampToEdgeWrapping;
  texture.wrapT = ClampToEdgeWrapping;
  // Use linear filtering for smoother arrow edges
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearMipmapLinearFilter;
  // Enable mipmaps for better quality at distance
  texture.generateMipmaps = true;

  return texture;
}
