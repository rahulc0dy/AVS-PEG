import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Scene, WebGLRenderer } from "three";
import { TRAFFIC_LIGHT_THRESHOLD } from "@/env";
// Named import of `ready` forces the bundler to include @tensorflow/tfjs
// (which registers WebGL / CPU backends as a side-effect).  We call ready()
// to await full backend initialization before loading the COCO-SSD model.
import { ready } from "@tensorflow/tfjs";
import {
  DetectedObject,
  load,
  ObjectDetection,
} from "@tensorflow-models/coco-ssd";
import { MiniViewport } from "@/components/hooks/use-mini-camera";

const DETECTION_RATE = 20;

/**
 * Minimum confidence score for COCO-SSD detections.
 * Lowered from the default 0.5 because 3D-rendered traffic lights
 * look different from real-world photos and produce lower scores.
 */
const MIN_DETECTION_SCORE = 0.2;

/**
 * ──── DEBUG: save every Nth detection frame as a PNG to public/debug-snapshots ────
 * Set to `true` to enable, `false` to disable.  `DEBUG_SAVE_EVERY` controls how
 * often a frame is saved (1 = every detection, 5 = every 5th detection, etc.).
 */
const DEBUG_SAVE_SNAPSHOTS = false;
const DEBUG_SAVE_EVERY = 5;

/**
 * Number of recent frames to keep for temporal majority-vote smoothing.
 * A higher value reduces flicker but increases latency.
 */
const SMOOTHING_WINDOW = 5;

/**
 * When no traffic lights are detected for this many consecutive detection
 * cycles the detections list is cleared. Prevents stale data while avoiding
 * single-frame "no detection" flicker.
 */
const MISS_GRACE_FRAMES = 3;

type TrafficLightColor = "RED" | "GREEN" | "YELLOW" | "UNKNOWN";

/**
 * Detection result augmented with a coarse traffic-light color classification.
 */
type TrafficLightDetection = DetectedObject & {
  color: TrafficLightColor;
};

/**
 * Hook that loads a COCO-SSD model and provides a helper to periodically run
 * object detection against the mini-camera viewport rendered on screen.
 *
 * `scanTraffic` reads pixels directly from the renderer's default framebuffer
 * (right after the mini camera scissored render), so the captured image has
 * the exact same brightness, tone mapping, and aspect ratio as the on-screen
 * mini camera inset.
 */
export function useTrafficDetector() {
  const [detections, setDetections] = useState<TrafficLightDetection[]>([]);

  const modelRef = useRef<ObjectDetection | null>(null);
  const pixelBufferRef = useRef<Uint8Array | null>(null);
  const lastViewportRef = useRef<{ w: number; h: number }>({ w: 0, h: 0 });
  const frameCountRef = useRef(0);
  const isDetectingRef = useRef(false);

  /** Reusable OffscreenCanvas for converting pixel data → ImageData for the model. */
  const offscreenCanvasRef = useRef<OffscreenCanvas | null>(null);

  /** Ring-buffer of the last N color results for temporal smoothing. */
  const colorHistoryRef = useRef<TrafficLightColor[]>([]);

  /** Consecutive detection cycles with zero traffic-light results. */
  const missCountRef = useRef(0);

  /** Counter for debug snapshot saving. */
  const debugSaveCountRef = useRef(0);

  useEffect(() => {
    // Ensure a TF.js backend (WebGL / WASM / CPU) is fully registered and
    // ready before loading the COCO-SSD graph model.  Without this, the
    // model load can race ahead of backend initialization and fail with
    // "No backend found in registry".
    ready()
      .then(() => load({ base: "mobilenet_v2" }))
      .then((loadedModel) => {
        console.log("🚦 Traffic Light Detector Loaded (mobilenet_v2)");
        modelRef.current = loadedModel;
      })
      .catch((error) => {
        console.error("Failed to load traffic light detector: ", error);
      });

    return () => {
      pixelBufferRef.current = null;
      offscreenCanvasRef.current = null;
    };
  }, []);

  /**
   * Ensure the pixel buffer and offscreen canvas match the viewport size.
   */
  const ensureBuffer = useCallback((w: number, h: number) => {
    const last = lastViewportRef.current;
    if (last.w !== w || last.h !== h || !pixelBufferRef.current) {
      pixelBufferRef.current = new Uint8Array(w * h * 4);
      offscreenCanvasRef.current = new OffscreenCanvas(w, h);
      lastViewportRef.current = { w, h };
    }
  }, []);

  /**
   * Run object detection on RGBA pixel data and update local state.
   *
   * Instead of manually constructing tensors, we convert the pixel buffer
   * into an ImageData and draw it onto an OffscreenCanvas. Passing the
   * canvas to `model.detect()` lets COCO-SSD use `tf.browser.fromPixels()`
   * internally — the most reliable and well-tested input path.
   */
  const detect = useCallback(
    async (pixelSnapshot: Uint8Array, width: number, height: number) => {
      const model = modelRef.current;
      if (!model) return;

      // Flip the WebGL pixel data vertically (bottom-to-top → top-to-bottom)
      const flipped = new Uint8ClampedArray(width * height * 4);
      const rowBytes = width * 4;
      for (let row = 0; row < height; row++) {
        const srcOffset = row * rowBytes;
        const dstOffset = (height - 1 - row) * rowBytes;
        flipped.set(
          pixelSnapshot.subarray(srcOffset, srcOffset + rowBytes),
          dstOffset,
        );
      }

      // Create an ImageData and paint it onto the offscreen canvas
      const imageData = new ImageData(flipped, width, height);
      let canvas = offscreenCanvasRef.current;
      if (!canvas || canvas.width !== width || canvas.height !== height) {
        canvas = new OffscreenCanvas(width, height);
        offscreenCanvasRef.current = canvas;
      }
      const ctx = canvas.getContext("2d")!;
      ctx.putImageData(imageData, 0, 0);

      // Feed the canvas to COCO-SSD with a lower confidence threshold
      // so we can catch detections the default 0.5 would discard.
      const results: DetectedObject[] = await model.detect(
        canvas as unknown as HTMLCanvasElement,
        20,
        MIN_DETECTION_SCORE,
      );

      const trafficLights = results
        .filter((r) => r.class === "traffic light")
        .map((light): TrafficLightDetection => {
          const rawColor = classifyTrafficLightColor(
            light.bbox,
            flipped,
            width,
            height,
          );

          // --- Temporal smoothing via majority-vote ---
          const history = colorHistoryRef.current;
          history.push(rawColor);
          if (history.length > SMOOTHING_WINDOW) history.shift();

          const smoothedColor = majorityVote(history);

          return { ...light, color: smoothedColor };
        });

      if (trafficLights.length > 0) {
        missCountRef.current = 0;
        setDetections(trafficLights);
      } else {
        missCountRef.current++;
        if (missCountRef.current >= MISS_GRACE_FRAMES) {
          colorHistoryRef.current = [];
          setDetections([]);
        }
      }
    },
    [],
  );

  /**
   * Read pixels from the renderer's default framebuffer (after the mini
   * camera has rendered its scissored viewport) and run detection.
   *
   * @param renderer Active WebGL renderer.
   * @param scene    Scene (unused — already rendered).
   * @param camera   Mini camera (unused — already rendered).
   * @param viewport The device-pixel rectangle of the mini camera viewport.
   */
  const scanTraffic = useCallback(
    (
      renderer: WebGLRenderer,
      scene: Scene,
      camera: Camera,
      viewport: MiniViewport,
    ) => {
      if (!modelRef.current) return;

      frameCountRef.current++;
      if (frameCountRef.current % DETECTION_RATE !== 0) return;

      // Skip if the previous detection is still in-flight
      if (isDetectingRef.current) return;

      const { x, y, width: vpW, height: vpH } = viewport;
      if (vpW <= 0 || vpH <= 0) return;

      ensureBuffer(vpW, vpH);
      const buf = pixelBufferRef.current!;

      // Read directly from the default framebuffer — captures the exact
      // pixels the user sees in the mini camera inset (same tone mapping,
      // encoding, brightness).
      const gl = renderer.getContext();
      gl.readPixels(x, y, vpW, vpH, gl.RGBA, gl.UNSIGNED_BYTE, buf);

      // Snapshot so the async path isn't affected by later reads
      const pixelSnapshot = new Uint8Array(buf);

      // ── DEBUG: save the exact image fed into detection ──
      if (DEBUG_SAVE_SNAPSHOTS) {
        debugSaveCountRef.current++;
        if (debugSaveCountRef.current % DEBUG_SAVE_EVERY === 0) {
          saveSnapshotAsImage(pixelSnapshot, vpW, vpH);
        }
      }

      isDetectingRef.current = true;
      detect(pixelSnapshot, vpW, vpH)
        .catch(console.error)
        .finally(() => {
          isDetectingRef.current = false;
        });
    },
    [detect, ensureBuffer],
  );

  return { scanTraffic, detections } as const;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Return the most-frequent color in `history`, breaking ties in favour of
 * RED > YELLOW > GREEN > UNKNOWN (fail-safe: prefer stopping).
 */
function majorityVote(history: TrafficLightColor[]): TrafficLightColor {
  if (history.length === 0) return "UNKNOWN";

  const counts: Record<TrafficLightColor, number> = {
    RED: 0,
    GREEN: 0,
    YELLOW: 0,
    UNKNOWN: 0,
  };
  for (const c of history) counts[c]++;

  // Tie-break priority: RED > YELLOW > GREEN > UNKNOWN
  const priority: TrafficLightColor[] = ["RED", "YELLOW", "GREEN", "UNKNOWN"];
  let best: TrafficLightColor = "UNKNOWN";
  let bestCount = 0;
  for (const color of priority) {
    if (counts[color] > bestCount) {
      bestCount = counts[color];
      best = color;
    }
  }
  return best;
}

/**
 * Convert RGB to HSV.  All outputs in [0,1] except H which is in [0,360).
 */
function rgbToHsv(
  r: number,
  g: number,
  b: number,
): { h: number; s: number; v: number } {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === rn) h = ((gn - bn) / d + 6) % 6;
    else if (max === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
    h *= 60;
  }
  const s = max === 0 ? 0 : d / max;
  return { h, s, v: max };
}

/**
 * Classify a pixel as a traffic-light color using HSV thresholds.
 * Returns null if the pixel is not a saturated, bright traffic-light color.
 */
function classifyPixelColor(
  r: number,
  g: number,
  b: number,
): TrafficLightColor | null {
  const { h, s, v } = rgbToHsv(r, g, b);

  // Require minimum saturation & brightness to ignore greys / dark pixels
  if (s < 0.3 || v < 0.35) return null;

  // Red wraps around 0°/360°  → hue < 20 or hue > 340
  if (h < 20 || h > 340) return "RED";
  // Yellow / amber → 20..55
  if (h >= 20 && h <= 55) return "YELLOW";
  // Green → 75..165
  if (h >= 75 && h <= 165) return "GREEN";

  return null;
}

/**
 * Infer traffic-light color by scanning pixels in the detection bounding box.
 *
 * Uses HSV-based color classification (more robust under varying lighting)
 * combined with positional weighting (top=red, middle=yellow, bottom=green)
 * and a position-independent fallback so that slightly mis-aligned bounding
 * boxes still produce a sensible result.
 *
 * NOTE: `pixelData` is expected in standard image layout (top-to-bottom rows).
 */
function classifyTrafficLightColor(
  bbox: number[],
  pixelData: Uint8ClampedArray,
  viewWidth: number,
  viewHeight: number,
): TrafficLightColor {
  const [x, y, w, h] = bbox.map(Math.floor);

  if (w <= 0 || h <= 0) return "UNKNOWN";

  // Shrink the scan region inward by 10 % on each side to avoid bbox edge noise
  const marginX = Math.max(1, Math.floor(w * 0.1));
  const marginY = Math.max(1, Math.floor(h * 0.1));
  const startCol = marginX;
  const endCol = w - marginX;
  const startRow = marginY;
  const endRow = h - marginY;

  // Position-weighted scores  (pixel in expected region gets full weight)
  let redScore = 0;
  let greenScore = 0;
  let yellowScore = 0;

  // Position-independent totals (fallback when positional scoring is ambiguous)
  let redTotal = 0;
  let greenTotal = 0;
  let yellowTotal = 0;

  for (let row = startRow; row < endRow; row++) {
    for (let col = startCol; col < endCol; col++) {
      const u = x + col;
      const v = y + row;

      if (u < 0 || u >= viewWidth || v < 0 || v >= viewHeight) continue;

      // Standard top-to-bottom image layout (already flipped)
      const index = (v * viewWidth + u) * 4;
      const r = pixelData[index];
      const g = pixelData[index + 1];
      const b = pixelData[index + 2];

      const color = classifyPixelColor(r, g, b);
      if (!color) continue;

      // Position-independent accumulation
      if (color === "RED") redTotal++;
      else if (color === "GREEN") greenTotal++;
      else if (color === "YELLOW") yellowTotal++;

      // Positional weighting (split into thirds)
      const relY = (row - startRow) / (endRow - startRow);
      if (relY < 0.33) {
        // Top third → expect RED
        if (color === "RED")
          redScore += 2; // strong signal
        else if (color === "YELLOW") yellowScore += 0.5;
      } else if (relY < 0.66) {
        // Middle third → expect YELLOW
        if (color === "YELLOW") yellowScore += 2;
        else if (color === "RED") redScore += 0.5;
        else if (color === "GREEN") greenScore += 0.5;
      } else {
        // Bottom third → expect GREEN
        if (color === "GREEN") greenScore += 2;
        else if (color === "YELLOW") yellowScore += 0.5;
      }
    }
  }

  const area = (endCol - startCol) * (endRow - startRow);
  // Require a minimum number of classified pixels (based on threshold %)
  const threshold = area * TRAFFIC_LIGHT_THRESHOLD;

  // ---- Primary: position-weighted decision ----
  const maxWeighted = Math.max(redScore, greenScore, yellowScore);
  if (maxWeighted >= threshold) {
    if (redScore === maxWeighted) return "RED";
    if (yellowScore === maxWeighted) return "YELLOW";
    if (greenScore === maxWeighted) return "GREEN";
  }

  // ---- Fallback: position-independent decision ----
  const maxTotal = Math.max(redTotal, greenTotal, yellowTotal);
  if (maxTotal >= threshold) {
    if (redTotal === maxTotal) return "RED";
    if (yellowTotal === maxTotal) return "YELLOW";
    if (greenTotal === maxTotal) return "GREEN";
  }

  return "UNKNOWN";
}

/**
 * Convert raw RGBA pixel data (WebGL layout: bottom-row-first) into a PNG
 * and POST it to `/api/debug-snapshot` so it is saved to disk.
 *
 * This produces the *exact* image that the COCO-SSD model receives,
 * making it easy to visually verify what the detector is seeing.
 */
function saveSnapshotAsImage(
  pixelData: Uint8Array,
  width: number,
  height: number,
): void {
  try {
    // Flip the image vertically (WebGL rows are bottom-to-top)
    const flipped = new Uint8ClampedArray(width * height * 4);
    const rowBytes = width * 4;
    for (let row = 0; row < height; row++) {
      const srcOffset = row * rowBytes;
      const dstOffset = (height - 1 - row) * rowBytes;
      flipped.set(
        pixelData.subarray(srcOffset, srcOffset + rowBytes),
        dstOffset,
      );
    }

    const imageData = new ImageData(flipped, width, height);
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext("2d")!;
    ctx.putImageData(imageData, 0, 0);

    canvas.convertToBlob({ type: "image/png" }).then((blob) => {
      fetch("/api/debug-snapshot", {
        method: "POST",
        body: blob,
        headers: { "Content-Type": "image/png" },
      })
        .then((res) => {
          if (!res.ok)
            console.warn("Debug snapshot upload failed:", res.status);
          else console.log("📸 Debug snapshot saved");
        })
        .catch((err) => console.warn("Debug snapshot upload error:", err));
    });
  } catch (err) {
    console.warn("Failed to create debug snapshot:", err);
  }
}
