import { useEffect, useRef, useState } from "react";
import { Camera, Scene, WebGLRenderer, WebGLRenderTarget } from "three";
import { TRAFFIC_LIGHT_THRESHOLD } from "@/env";
import { tensor3d, tidy } from "@tensorflow/tfjs";
import {
  DetectedObject,
  load,
  ObjectDetection,
} from "@tensorflow-models/coco-ssd";

const AI_VIEW_SIZE = 300;
const DETECTION_RATE = 20;

export function useTrafficDetector() {
  const [model, setModel] = useState<ObjectDetection | null>(null);
  const [detections, setDetections] = useState<DetectedObject[]>([]);

  const renderTargetRef = useRef<WebGLRenderTarget | null>(null);
  const pixelBufferRef = useRef<Uint8Array | null>(null);
  const frameCountRef = useRef(0);

  useEffect(() => {
    load()
      .then((loadedModel) => {
        console.log("🚦 Traffic Light Detector Loaded");
        setModel(loadedModel);
      })
      .catch((error) => {
        console.error("Failed to load traffic light detector: ", error);
      });

    renderTargetRef.current = new WebGLRenderTarget(AI_VIEW_SIZE, AI_VIEW_SIZE);
    pixelBufferRef.current = new Uint8Array(AI_VIEW_SIZE * AI_VIEW_SIZE * 4);

    return () => {
      renderTargetRef.current?.dispose();
      pixelBufferRef.current = null;
    };
  }, []);

  const scanTraffic = (
    renderer: WebGLRenderer,
    scene: Scene,
    camera: Camera,
  ) => {
    if (!model || !renderTargetRef.current || !pixelBufferRef.current) return;

    frameCountRef.current++;
    if (frameCountRef.current % DETECTION_RATE !== 0) return;

    const originalTarget = renderer.getRenderTarget();
    renderer.setRenderTarget(renderTargetRef.current);
    renderer.render(scene, camera);

    renderer.readRenderTargetPixels(
      renderTargetRef.current,
      0,
      0,
      AI_VIEW_SIZE,
      AI_VIEW_SIZE,
      pixelBufferRef.current,
    );

    renderer.setRenderTarget(originalTarget);

    detect(pixelBufferRef.current).catch(console.error);
  };

  const detect = async (pixelData: Uint8Array) => {
    if (!model) return;

    const predictions = tidy(() => {
      const imgTensor = tensor3d(
        pixelData,
        [AI_VIEW_SIZE, AI_VIEW_SIZE, 4],
        "int32",
      );
      const rgb = imgTensor.slice([0, 0, 0], [-1, -1, 3]);
      return rgb.reverse(0); // flip Y-axis
    });

    const results = await model.detect(predictions);
    predictions.dispose();

    const trafficLights = results
      .filter((r) => r.class === "traffic light")
      .map((light) => {
        const color = getTrafficLightColor(light.bbox, pixelData, AI_VIEW_SIZE);

        return {
          ...light,
          color: color,
        };
      });

    setDetections(trafficLights);
  };

  return { scanTraffic, detections };
}

function getTrafficLightColor(
  bbox: number[],
  pixelData: Uint8Array,
  viewSize: number,
): "RED" | "GREEN" | "YELLOW" | "UNKNOWN" {
  const [x, y, w, h] = bbox.map(Math.floor);

  let redScore = 0;
  let greenScore = 0;
  let yellowScore = 0;

  for (let row = 0; row < h; row++) {
    for (let col = 0; col < w; col++) {
      const u = x + col;
      const v = y + row;
      const webGLRow = viewSize - 1 - v; // Invert Y for WebGL reading

      if (u < 0 || u >= viewSize || webGLRow < 0 || webGLRow >= viewSize)
        continue;

      const index = (webGLRow * viewSize + u) * 4;
      const r = pixelData[index];
      const g = pixelData[index + 1];
      const b = pixelData[index + 2];

      // 1. Define Color Thresholds
      // Red: High Red, Low Green/Blue
      const isRed = r > 150 && g < 100 && b < 100;
      // Green: High Green, Low Red/Blue
      const isGreen = g > 150 && r < 100 && b < 100;
      // Yellow: High Red AND High Green (Mixed), Low Blue
      const isYellow = r > 150 && g > 150 && b < 100;

      // 2. Define Position Logic (Split into thirds)
      // Top 1/3 = RED region
      if (row < h * 0.33) {
        if (isRed) redScore++;
      }
      // Middle 1/3 = YELLOW region
      else if (row >= h * 0.33 && row < h * 0.66) {
        if (isYellow) yellowScore++;
      }
      // Bottom 1/3 = GREEN region
      else {
        if (isGreen) greenScore++;
      }
    }
  }

  // 3. Decision
  const threshold = w * h * TRAFFIC_LIGHT_THRESHOLD; // 5% of pixels must match

  const maxScore = Math.max(redScore, greenScore, yellowScore);

  if (maxScore < threshold) {
    return "UNKNOWN";
  }

  switch (maxScore) {
    case redScore:
      return "RED";
    case greenScore:
      return "GREEN";
    case yellowScore:
      return "YELLOW";
    default:
      return "UNKNOWN";
  }
}
