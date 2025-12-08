import { useEffect, useRef, useState } from "react";
import * as tf from "@tensorflow/tfjs";
import * as cocoSsd from "@tensorflow-models/coco-ssd";
import {
  WebGLRenderer,
  Scene,
  Camera,
  WebGLRenderTarget,
  Vector3,
} from "three";

const AI_VIEW_SIZE = 300;
const DETECTION_RATE = 20;

export function useTrafficDetector() {
  const [model, setModel] = useState<cocoSsd.ObjectDetection | null>(null);
  const [detections, setDetections] = useState<cocoSsd.DetectedObject[]>([]);

  const renderTargetRef = useRef<WebGLRenderTarget | null>(null);
  const pixelBufferRef = useRef<Uint8Array | null>(null);
  const frameCountRef = useRef(0);
  // const debugCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // useEffect(() => {
  //   // Create a visible canvas and append to body for debugging
  //   const canvas = document.createElement("canvas");
  //   canvas.width = 300;
  //   canvas.height = 300;
  //   canvas.style.position = "fixed";
  //   canvas.style.top = "10px";
  //   canvas.style.right = "10px";
  //   canvas.style.zIndex = "1000";
  //   canvas.style.border = "2px solid red"; // Red border to spot it easily
  //   document.body.appendChild(canvas);
  //   debugCanvasRef.current = canvas;

  //   return () => {
  //     document.body.removeChild(canvas);
  //   };
  // }, []);

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

    // --- DEBUG: VISUALIZE BUFFER ---
    // if (debugCanvasRef.current && pixelBufferRef.current) {
    //   const ctx = debugCanvasRef.current.getContext("2d");
    //   if (ctx) {
    //     const imgData = ctx.createImageData(AI_VIEW_SIZE, AI_VIEW_SIZE);
    //     // Copy buffer to ImageData
    //     // NOTE: This copies raw WebGL data. If it draws upside down here,
    //     // it confirms the AI sees it upside down.
    //     imgData.data.set(pixelBufferRef.current);
    //     ctx.putImageData(imgData, 0, 0);
    //   }
    // }

    renderer.setRenderTarget(originalTarget);

    detect(pixelBufferRef.current);
  };

  const detect = async (pixelData: Uint8Array) => {
    if (!model) return;

    const predictions = await tf.tidy(() => {
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

    const trafficLights = results.filter((r) => r.class === "traffic light");

    if (trafficLights.length > 0) {
      setDetections(trafficLights);
      // Optional: Check if Red or Green here
    }
  };

  return { scanTraffic, detections };
}
