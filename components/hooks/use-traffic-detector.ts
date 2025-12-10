import { useEffect, useRef, useState } from "react";
import * as tf from "@tensorflow/tfjs";
import * as cocoSsd from "@tensorflow-models/coco-ssd";
import { Camera, Scene, WebGLRenderer, WebGLRenderTarget } from "three";

const AI_VIEW_SIZE = 300;
const DETECTION_RATE = 20;

export function useTrafficDetector() {
  const [model, setModel] = useState<cocoSsd.ObjectDetection | null>(null);
  const [detections, setDetections] = useState<cocoSsd.DetectedObject[]>([]);

  const renderTargetRef = useRef<WebGLRenderTarget | null>(null);
  const pixelBufferRef = useRef<Uint8Array | null>(null);
  const frameCountRef = useRef(0);

  useEffect(() => {
    cocoSsd.load().then((loadedModel) => {
      console.log("🚦 Traffic Light Detector Loaded");
      setModel(loadedModel);
    });

    renderTargetRef.current = new WebGLRenderTarget(AI_VIEW_SIZE, AI_VIEW_SIZE);
    pixelBufferRef.current = new Uint8Array(AI_VIEW_SIZE * AI_VIEW_SIZE * 4);

    return () => {
      renderTargetRef.current?.dispose();
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

    detect(pixelBufferRef.current);
  };

  const detect = async (pixelData: Uint8Array) => {
    if (!model) return;

    const predictions = tf.tidy(() => {
      const imgTensor = tf.tensor3d(
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

  // Counters for bright pixels
  let redScore = 0;
  let greenScore = 0;
  // let yellowScore = 0; // Optional if you have yellow lights

  // Loop through the bounding box
  for (let row = 0; row < h; row++) {
    for (let col = 0; col < w; col++) {
      // 1. Calculate Standard Coordinates (relative to image top-left)
      const u = x + col;
      const v = y + row;

      // 2. Convert to WebGL Coordinates (flip Y)
      // WebGL Row 0 is at the bottom, so we invert 'v'
      const webGLRow = viewSize - 1 - v;

      // Safety check to stay within bounds
      if (u < 0 || u >= viewSize || webGLRow < 0 || webGLRow >= viewSize)
        continue;

      // 3. Get Pixel Index
      const index = (webGLRow * viewSize + u) * 4;
      const r = pixelData[index];
      const g = pixelData[index + 1];
      const b = pixelData[index + 2];

      // 4. Color Logic
      // Check if pixel is "Bright Red"
      if (r > 150 && g < 100 && b < 100) {
        // Red lights are physically in the TOP half of the box
        if (row < h / 2) redScore++;
      }
      // Check if pixel is "Bright Green"
      else if (g > 150 && r < 100 && b < 100) {
        // Green lights are physically in the BOTTOM half of the box
        if (row > h / 2) greenScore++;
      }
    }
  }

  // 5. Decision Threshold (requires e.g., >5% of pixels to match)
  const threshold = w * h * 0.05;

  if (redScore > threshold && redScore > greenScore) return "RED";
  if (greenScore > threshold && greenScore > redScore) return "GREEN";

  return "UNKNOWN";
}
