"use client";

import { useCallback, useMemo } from "react";
import Image from "next/image";
import { NeuralNetworkStateJson } from "@/types/car/state";
import { SlideablePanel } from "@/components/ui/slideable-panel";

interface NeuralNetworkVisualizerProps {
  state?: NeuralNetworkStateJson | null;
}

/**
 * Bottom slideable panel that visualizes a neural network.
 * Shows neurons as circles and connections as lines with weights.
 */
export const NeuralNetworkVisualizer = ({
  state,
}: NeuralNetworkVisualizerProps) => {
  // Calculate network architecture for visualization
  const architecture = useMemo(() => {
    if (!state) return null;

    const layers: number[] = [];
    if (state.levels.length > 0) {
      layers.push(state.levels[0].inputs.length);
      for (const level of state.levels) {
        layers.push(level.outputs.length);
      }
    }
    return layers;
  }, [state]);

  // Get activation values from state or default to zeros
  const activations = useMemo(() => {
    if (!state || !architecture) return null;

    const result: number[][] = [];
    // Input layer
    result.push(state.inputs);
    // Hidden and output layers
    for (const levelState of state.levels) {
      result.push(levelState.outputs);
    }
    return result;
  }, [state, architecture]);

  // Get weights from state
  const weights = useMemo(() => {
    if (!state) return null;
    return state.levels.map((level) => level.weights);
  }, [state]);

  return (
    <SlideablePanel
      title="Neural Network"
      icon={
        <Image
          src="/icons/brain.svg"
          alt="Brain"
          width={16}
          height={16}
          className="invert"
        />
      }
      position="bottom"
      expandedSize="18rem"
    >
      {!state ? (
        <div className="h-full flex items-center justify-center">
          <p className="text-zinc-500 text-sm">
            No neural network available. Spawn cars to visualize.
          </p>
        </div>
      ) : architecture ? (
        <NetworkCanvas
          architecture={architecture}
          activations={activations}
          weights={weights}
        />
      ) : null}
    </SlideablePanel>
  );
};

interface NetworkCanvasProps {
  architecture: number[];
  activations: number[][] | null;
  weights: number[][][] | null;
}

/**
 * Canvas-based neural network visualization.
 */
const NetworkCanvas = ({
  architecture,
  activations,
  weights,
}: NetworkCanvasProps) => {
  const canvasRef = useCallback(
    (canvas: HTMLCanvasElement | null) => {
      if (!canvas) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Get actual dimensions
      const rect = canvas.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;

      // Set canvas resolution
      canvas.width = width * window.devicePixelRatio;
      canvas.height = height * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

      // Clear canvas
      ctx.clearRect(0, 0, width, height);

      const numLayers = architecture.length;
      const maxNeurons = Math.max(...architecture);
      const layerSpacing = width / (numLayers + 1);
      const neuronRadius = Math.min(12, height / (maxNeurons * 3));

      // Calculate neuron positions
      const neuronPositions: { x: number; y: number }[][] = [];

      for (let layerIdx = 0; layerIdx < numLayers; layerIdx++) {
        const neuronCount = architecture[layerIdx];
        const x = layerSpacing * (layerIdx + 1);
        const layerHeight = (neuronCount - 1) * (neuronRadius * 3);
        const startY = (height - layerHeight) / 2;

        const layerPositions: { x: number; y: number }[] = [];
        for (let neuronIdx = 0; neuronIdx < neuronCount; neuronIdx++) {
          const y = startY + neuronIdx * (neuronRadius * 3);
          layerPositions.push({ x, y });
        }
        neuronPositions.push(layerPositions);
      }

      // Draw connections (weights)
      for (let layerIdx = 0; layerIdx < numLayers - 1; layerIdx++) {
        const fromLayer = neuronPositions[layerIdx];
        const toLayer = neuronPositions[layerIdx + 1];
        const layerWeights = weights?.[layerIdx];

        for (let fromIdx = 0; fromIdx < fromLayer.length; fromIdx++) {
          for (let toIdx = 0; toIdx < toLayer.length; toIdx++) {
            const from = fromLayer[fromIdx];
            const to = toLayer[toIdx];

            // Get weight value for color
            const weight = layerWeights?.[fromIdx]?.[toIdx] ?? 0;
            const normalizedWeight = Math.max(-1, Math.min(1, weight));

            // Color based on weight: red for negative, green for positive
            let color: string;
            const alpha = Math.abs(normalizedWeight) * 0.6 + 0.1;

            if (normalizedWeight > 0) {
              const intensity = Math.floor(normalizedWeight * 200 + 55);
              color = `rgba(${55}, ${intensity}, ${100}, ${alpha})`;
            } else {
              const intensity = Math.floor(-normalizedWeight * 200 + 55);
              color = `rgba(${intensity}, ${55}, ${100}, ${alpha})`;
            }

            ctx.beginPath();
            ctx.moveTo(from.x, from.y);
            ctx.lineTo(to.x, to.y);
            ctx.strokeStyle = color;
            ctx.lineWidth = Math.abs(normalizedWeight) * 2 + 0.5;
            ctx.stroke();
          }
        }
      }

      // Draw neurons
      for (let layerIdx = 0; layerIdx < numLayers; layerIdx++) {
        const layer = neuronPositions[layerIdx];
        const layerActivations = activations?.[layerIdx];

        for (let neuronIdx = 0; neuronIdx < layer.length; neuronIdx++) {
          const { x, y } = layer[neuronIdx];
          const activation = layerActivations?.[neuronIdx] ?? 0;

          // Neuron fill based on activation
          const fillIntensity = Math.floor(activation * 200 + 55);
          const fillColor =
            activation > 0.5
              ? `rgb(${55}, ${fillIntensity}, ${100})`
              : `rgb(${80}, ${80}, ${80})`;

          // Draw neuron circle
          ctx.beginPath();
          ctx.arc(x, y, neuronRadius, 0, Math.PI * 2);
          ctx.fillStyle = fillColor;
          ctx.fill();
          ctx.strokeStyle = "#a1a1aa"; // zinc-400
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      }

      // Draw layer labels
      ctx.fillStyle = "#71717a"; // zinc-500
      ctx.font = "11px sans-serif";
      ctx.textAlign = "center";

      const labels = [
        "Inputs",
        ...architecture.slice(1, -1).map((_, i) => `H${i + 1}`),
        "Outputs",
      ];
      for (let layerIdx = 0; layerIdx < numLayers; layerIdx++) {
        const x = layerSpacing * (layerIdx + 1);
        ctx.fillText(labels[layerIdx], x, height - 8);
      }
    },
    [architecture, activations, weights],
  );

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full"
      style={{ minHeight: "200px" }}
    />
  );
};
