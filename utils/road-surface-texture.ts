import { CanvasTexture, ClampToEdgeWrapping, LinearFilter } from "three";

export interface RoadTextureConfig {
  laneCount: number;
  isOneWay: boolean;
  roadLength: number;
  showArrows?: boolean;
}

/**
 * Creates a single road texture with dashed lane dividers and sparse arrows.
 * No repeating - the entire road is drawn on one texture.
 */
export function createRoadTexture(config: RoadTextureConfig): CanvasTexture {
  const { laneCount, isOneWay, roadLength, showArrows = true } = config;

  const pixelsPerUnit = 8;
  const laneWidthPx = 64;
  const width = laneCount * laneWidthPx;
  const height = Math.max(128, Math.round(roadLength * pixelsPerUnit));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d")!;

  // Road background
  ctx.fillStyle = "#2a2a2a";
  ctx.fillRect(0, 0, width, height);

  // Dashed lane dividers
  ctx.fillStyle = "#FFFFFF";
  const dashLen = 40;
  const gapLen = 40;
  const dividerW = 4;

  for (let i = 1; i < laneCount; i++) {
    const x = i * laneWidthPx - dividerW / 2;
    for (let y = 0; y < height; y += dashLen + gapLen) {
      ctx.fillRect(x, y, dividerW, dashLen);
    }
  }

  // Sparse arrows
  if (showArrows) {
    ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
    const arrowSpacing = 600; // pixels
    const numArrows = Math.max(1, Math.floor(height / arrowSpacing));

    for (let i = 0; i < numArrows; i++) {
      const y = arrowSpacing * (i + 0.5);
      for (let lane = 0; lane < laneCount; lane++) {
        const cx = (lane + 0.5) * laneWidthPx;
        const up = isOneWay || lane >= laneCount / 2;
        drawArrow(ctx, cx, y, laneWidthPx * 0.3, up);
      }
    }
  }

  const texture = new CanvasTexture(canvas);
  texture.wrapS = ClampToEdgeWrapping;
  texture.wrapT = ClampToEdgeWrapping;
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearFilter;
  texture.generateMipmaps = false;

  return texture;
}

function drawArrow(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  up: boolean,
): void {
  ctx.save();
  ctx.translate(cx, cy);
  if (!up) ctx.rotate(Math.PI);

  const h = size * 1.2;
  const headW = size * 0.7;
  const headH = size * 0.4;
  const bodyW = size * 0.25;

  ctx.beginPath();
  ctx.moveTo(0, -h / 2);
  ctx.lineTo(-headW / 2, -h / 2 + headH);
  ctx.lineTo(-bodyW / 2, -h / 2 + headH);
  ctx.lineTo(-bodyW / 2, h / 2);
  ctx.lineTo(bodyW / 2, h / 2);
  ctx.lineTo(bodyW / 2, -h / 2 + headH);
  ctx.lineTo(headW / 2, -h / 2 + headH);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}
