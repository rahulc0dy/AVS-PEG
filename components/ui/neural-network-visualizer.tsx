"use client";

import { useEffect, useRef, useMemo } from "react";
import type {
  NeuralNetworkJson,
  NeuralNetworkStateJson,
} from "@/lib/ai/network";

/** Output neuron labels for the car controls */
const OUTPUT_LABELS = ["Forward", "Left", "Right", "Reverse"];

/** Input neuron labels (10 rays + 4 features) */
const INPUT_LABELS = [
  "Ray 0",
  "Ray 1",
  "Ray 2",
  "Ray 3",
  "Ray 4",
  "Ray 5",
  "Ray 6",
  "Ray 7",
  "Ray 8",
  "Ray 9",
  "Road Offset",
  "Road Angle",
  "Dest Angle",
  "Dest Dist",
];

interface NeuralNetworkVisualizerProps {
  /** The neural network JSON to visualize (static structure) */
  brain: NeuralNetworkJson | null;
  /** Real-time network state for live visualization */
  networkState?: NeuralNetworkStateJson | null;
  /** Width of the canvas */
  width?: number;
  /** Height of the canvas */
  height?: number;
  /** Whether to show weight/bias labels */
  showLabels?: boolean;
}

/**
 * Interpolates between two colors based on a value between -1 and 1.
 * Negative values are red, positive values are green, zero is gray.
 */
function getWeightColor(value: number, alpha: number = 1): string {
  const clampedValue = Math.max(-1, Math.min(1, value));

  if (clampedValue > 0) {
    // Positive: green
    const intensity = Math.floor(clampedValue * 255);
    return `rgba(${50}, ${150 + intensity * 0.4}, ${50}, ${alpha})`;
  } else if (clampedValue < 0) {
    // Negative: red
    const intensity = Math.floor(-clampedValue * 255);
    return `rgba(${150 + intensity * 0.4}, ${50}, ${50}, ${alpha})`;
  }
  return `rgba(128, 128, 128, ${alpha})`;
}

/**
 * Gets the activation color for a neuron.
 * Active (1) = yellow/gold, Inactive (0) = dark gray, Semi-active = gradient
 */
function getActivationColor(value: number): string {
  if (value >= 0.9) {
    return "#ffd700"; // Gold - active
  } else if (value >= 0.5) {
    return "#ffaa00"; // Orange - semi-active
  } else if (value > 0) {
    return "#885500"; // Dark orange - low activity
  }
  return "#333333"; // Dark gray - inactive
}

/**
 * Gets the stroke color for an edge based on the weight and whether it's active.
 */
function getEdgeColor(weight: number, inputValue: number): string {
  const isActive = inputValue > 0.1;
  const alpha = isActive ? Math.min(0.3 + Math.abs(weight) * 0.7, 1) : 0.15;
  return getWeightColor(weight, alpha);
}

/**
 * Neural Network Visualizer Component
 *
 * Renders a visual representation of a neural network showing:
 * - All layers (inputs, hidden layers, outputs)
 * - Weights as colored edges between neurons
 * - Biases displayed on neurons
 * - Active/semi-active states highlighted
 * - Output labels (Forward, Left, Right, Reverse)
 */
export function NeuralNetworkVisualizer({
  brain,
  networkState,
  width = 400,
  height = 300,
  showLabels = false,
}: NeuralNetworkVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Build layer structure from brain JSON
  const layers = useMemo(() => {
    if (!brain || !brain.levels || brain.levels.length === 0) {
      return [];
    }

    const result: {
      inputs: number[];
      outputs: number[];
      biases: number[];
      weights: number[][];
    }[] = [];

    for (const level of brain.levels) {
      result.push({
        inputs: level.inputCount ? new Array(level.inputCount).fill(0) : [],
        outputs: level.outputCount ? new Array(level.outputCount).fill(0) : [],
        biases: level.biases || [],
        weights: level.weights || [],
      });
    }

    return result;
  }, [brain]);

  // Get neuron counts per layer
  const neuronCounts = useMemo(() => {
    if (layers.length === 0) return [];

    const counts: number[] = [];
    // First layer's input count
    if (layers[0]) {
      counts.push(layers[0].inputs.length || layers[0].weights?.length || 0);
    }
    // Output counts of each layer
    for (const layer of layers) {
      counts.push(layer.biases?.length || layer.outputs?.length || 0);
    }
    return counts;
  }, [layers]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !brain) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear canvas with dark background
    ctx.fillStyle = "#1a1a1a";
    ctx.fillRect(0, 0, width, height);

    if (layers.length === 0 || neuronCounts.length === 0) {
      ctx.fillStyle = "#666";
      ctx.font = "14px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("No network data", width / 2, height / 2);
      return;
    }

    const padding = 40;
    const layerCount = neuronCounts.length;
    const layerSpacing = (width - padding * 2) / (layerCount - 1);

    // Calculate neuron positions for each layer
    const neuronPositions: { x: number; y: number }[][] = [];

    for (let layerIdx = 0; layerIdx < layerCount; layerIdx++) {
      const count = neuronCounts[layerIdx];
      const x = padding + layerIdx * layerSpacing;
      const positions: { x: number; y: number }[] = [];

      // Calculate vertical spacing for this layer
      const availableHeight = height - padding * 2;
      const neuronSpacing = count > 1 ? availableHeight / (count - 1) : 0;
      const startY = count > 1 ? padding : height / 2;

      for (let neuronIdx = 0; neuronIdx < count; neuronIdx++) {
        positions.push({
          x,
          y: startY + neuronIdx * neuronSpacing,
        });
      }
      neuronPositions.push(positions);
    }

    // Get real-time input values from networkState if available
    const getInputValue = (levelIdx: number, inputIdx: number): number => {
      if (!networkState?.levels?.[levelIdx]) {
        return 0.5; // Default to half-active if no state
      }
      return networkState.levels[levelIdx].inputs[inputIdx] ?? 0;
    };

    // Get real-time output value (activation) from networkState
    const getOutputValue = (levelIdx: number, outputIdx: number): number => {
      if (!networkState?.levels?.[levelIdx]) {
        return 0;
      }
      return networkState.levels[levelIdx].outputs[outputIdx] ?? 0;
    };

    // Draw edges (weights) between layers
    for (let levelIdx = 0; levelIdx < layers.length; levelIdx++) {
      const level = brain.levels[levelIdx];
      if (!level || !level.weights) continue;

      const fromPositions = neuronPositions[levelIdx];
      const toPositions = neuronPositions[levelIdx + 1];

      if (!fromPositions || !toPositions) continue;

      for (let i = 0; i < level.weights.length; i++) {
        for (let j = 0; j < level.weights[i].length; j++) {
          const weight = level.weights[i][j];
          const fromPos = fromPositions[i];
          const toPos = toPositions[j];

          if (!fromPos || !toPos) continue;

          // Get the actual input value for this edge from real-time state
          const inputValue = getInputValue(levelIdx, i);

          // Calculate edge contribution: input * weight
          const contribution = inputValue * weight;
          const isActiveEdge = Math.abs(contribution) > 0.1;

          // Edge width based on weight magnitude
          const edgeWidth = Math.max(0.5, Math.abs(weight) * 3);

          ctx.strokeStyle = getEdgeColor(weight, inputValue);
          ctx.lineWidth = isActiveEdge ? edgeWidth * 1.5 : edgeWidth;
          ctx.beginPath();
          ctx.moveTo(fromPos.x, fromPos.y);
          ctx.lineTo(toPos.x, toPos.y);
          ctx.stroke();

          // Draw weight label if enabled
          if (showLabels && Math.abs(weight) > 0.3) {
            const midX = (fromPos.x + toPos.x) / 2;
            const midY = (fromPos.y + toPos.y) / 2;
            ctx.fillStyle = "#aaa";
            ctx.font = "8px monospace";
            ctx.textAlign = "center";
            ctx.fillText(weight.toFixed(2), midX, midY);
          }
        }
      }
    }

    // Draw neurons
    const neuronRadius = 12;

    for (let layerIdx = 0; layerIdx < neuronCounts.length; layerIdx++) {
      const positions = neuronPositions[layerIdx];
      const isInputLayer = layerIdx === 0;
      const isOutputLayer = layerIdx === neuronCounts.length - 1;

      for (let neuronIdx = 0; neuronIdx < positions.length; neuronIdx++) {
        const pos = positions[neuronIdx];

        // Get bias and activation for this neuron
        let bias = 0;
        let activation = 0;

        if (isInputLayer) {
          // For input layer, get the actual input values
          if (networkState?.inputs) {
            activation = networkState.inputs[neuronIdx] ?? 0;
          } else {
            activation = 0.5;
          }
        } else {
          // For hidden and output layers
          const level = brain.levels[layerIdx - 1];
          if (level && level.biases) {
            bias = level.biases[neuronIdx] || 0;
          }
          // Get actual activation from real-time state
          activation = getOutputValue(layerIdx - 1, neuronIdx);
        }

        // Draw neuron circle
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, neuronRadius, 0, Math.PI * 2);

        if (isOutputLayer) {
          // Output neurons get special treatment - highlight active outputs
          ctx.fillStyle = getActivationColor(activation);
          ctx.strokeStyle = activation > 0.5 ? "#ffd700" : "#fff";
          ctx.lineWidth = activation > 0.5 ? 3 : 2;
        } else if (isInputLayer) {
          // Input neurons - show activation level through color
          const inputIntensity = Math.floor(activation * 100);
          ctx.fillStyle = `rgb(${68 + inputIntensity}, ${85 + inputIntensity}, ${102 + inputIntensity})`;
          ctx.strokeStyle = "#667788";
          ctx.lineWidth = 1;
        } else {
          // Hidden neurons
          ctx.fillStyle = getActivationColor(activation);
          ctx.strokeStyle = "#888";
          ctx.lineWidth = 1;
        }

        ctx.fill();
        ctx.stroke();

        // Draw bias label inside neuron for non-input layers
        if (!isInputLayer && showLabels) {
          ctx.fillStyle = "#fff";
          ctx.font = "8px monospace";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(bias.toFixed(1), pos.x, pos.y);
        }

        // Draw neuron index or activation value
        if (!showLabels) {
          ctx.fillStyle = "#fff";
          ctx.font = "9px sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          // Show activation for input layer, index for others
          if (isInputLayer && networkState?.inputs) {
            ctx.fillText(activation.toFixed(1), pos.x, pos.y);
          } else {
            ctx.fillText(String(neuronIdx), pos.x, pos.y);
          }
        }

        // Draw input labels
        if (isInputLayer && INPUT_LABELS[neuronIdx]) {
          ctx.fillStyle = activation > 0.5 ? "#aaa" : "#666";
          ctx.font = "9px sans-serif";
          ctx.textAlign = "right";
          ctx.textBaseline = "middle";
          ctx.fillText(
            INPUT_LABELS[neuronIdx],
            pos.x - neuronRadius - 4,
            pos.y,
          );
        }

        // Draw output labels
        if (isOutputLayer && OUTPUT_LABELS[neuronIdx]) {
          ctx.fillStyle = activation > 0.5 ? "#ffd700" : "#888";
          ctx.font = "bold 10px sans-serif";
          ctx.textAlign = "left";
          ctx.textBaseline = "middle";
          ctx.fillText(
            OUTPUT_LABELS[neuronIdx],
            pos.x + neuronRadius + 6,
            pos.y,
          );
        }
      }
    }

    // Draw layer labels
    ctx.fillStyle = "#666";
    ctx.font = "10px sans-serif";
    ctx.textAlign = "center";

    const labels = [
      "Inputs",
      ...Array(layers.length - 1).fill("Hidden"),
      "Outputs",
    ];
    if (labels.length > neuronCounts.length) {
      labels.length = neuronCounts.length;
    }
    // Fix labels for the actual layer count
    const finalLabels: string[] = [];
    for (let i = 0; i < neuronCounts.length; i++) {
      if (i === 0) finalLabels.push("Inputs");
      else if (i === neuronCounts.length - 1) finalLabels.push("Outputs");
      else finalLabels.push("Hidden");
    }

    for (let i = 0; i < neuronCounts.length; i++) {
      const x = padding + i * layerSpacing;
      ctx.fillText(finalLabels[i], x, 15);
      ctx.fillText(`(${neuronCounts[i]})`, x, 26);
    }

    // Draw legend
    const legendX = width - 80;
    const legendY = height - 60;

    ctx.fillStyle = "#666";
    ctx.font = "9px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Legend:", legendX, legendY);

    // Positive weight
    ctx.fillStyle = getWeightColor(0.8, 1);
    ctx.fillRect(legendX, legendY + 8, 12, 3);
    ctx.fillStyle = "#888";
    ctx.fillText("+ weight", legendX + 16, legendY + 12);

    // Negative weight
    ctx.fillStyle = getWeightColor(-0.8, 1);
    ctx.fillRect(legendX, legendY + 20, 12, 3);
    ctx.fillStyle = "#888";
    ctx.fillText("- weight", legendX + 16, legendY + 24);

    // Active neuron
    ctx.beginPath();
    ctx.arc(legendX + 6, legendY + 38, 5, 0, Math.PI * 2);
    ctx.fillStyle = "#ffd700";
    ctx.fill();
    ctx.fillStyle = "#888";
    ctx.fillText("active", legendX + 16, legendY + 40);
  }, [brain, networkState, layers, neuronCounts, width, height, showLabels]);

  if (!brain) {
    return (
      <div
        className="flex items-center justify-center bg-zinc-900 text-zinc-500 rounded"
        style={{ width, height }}
      >
        No brain loaded
      </div>
    );
  }

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="rounded border border-zinc-700"
    />
  );
}
