import React, { useCallback, useEffect, useRef, useState } from "react";

interface NetworkCanvasProps {
  architecture: number[];
  activations: number[][] | null;
  weights: number[][][] | null;
  biases: number[][] | null;
  onWeightChange?: (
    layerIdx: number,
    fromIdx: number,
    toIdx: number,
    value: number,
  ) => void;
  onBiasChange?: (layerIdx: number, neuronIdx: number, value: number) => void;
}

interface HoveredNeuron {
  layerIdx: number;
  neuronIdx: number;
}

interface HoveredConnection {
  layerIdx: number;
  fromIdx: number;
  toIdx: number;
}

interface MousePosition {
  x: number;
  y: number;
}

interface NeuronPosition {
  x: number;
  y: number;
}

// ============================================================================
// Constants
// ============================================================================

const COLORS = {
  neuronStroke: "#a1a1aa", // zinc-400
  labelText: "#ffffff", // zinc-500
  inactiveNeuron: "rgb(80, 80, 80)",
} as const;

const LAYOUT = {
  maxNeuronRadius: 1600,
  neuronSpacingMultiplier: 3,
  neuronRadiusDivisor: 4,
  strokeWidth: 1.5,
  labelFontSize: "14px sans-serif",
  labelOffset: 8,
} as const;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculates color based on weight value.
 * Green for positive weights, red for negative weights.
 */
function getWeightColor(weight: number): string {
  const normalizedWeight = Math.max(-1, Math.min(1, weight));
  const alpha = Math.abs(normalizedWeight) * 0.6 + 0.1;
  const intensity = Math.floor(Math.abs(normalizedWeight) * 200 + 55);

  if (normalizedWeight > 0) {
    return `rgba(55, ${intensity}, 100, ${alpha})`;
  }
  return `rgba(${intensity}, 55, 100, ${alpha})`;
}

/**
 * Calculates line width based on weight magnitude.
 */
function getWeightLineWidth(weight: number): number {
  const normalizedWeight = Math.max(-1, Math.min(1, weight));
  return Math.abs(normalizedWeight) * 2 + 0.5;
}

/**
 * Calculates neuron fill color based on activation value.
 */
function getNeuronFillColor(activation: number): string {
  if (activation > 0.5) {
    const fillIntensity = Math.floor(activation * 200 + 55);
    return `rgb(55, ${fillIntensity}, 100)`;
  }
  return COLORS.inactiveNeuron;
}

/**
 * Calculates positions for all neurons in the network.
 */
function calculateNeuronPositions(
  architecture: number[],
  width: number,
  height: number,
  neuronRadius: number,
): NeuronPosition[][] {
  const numLayers = architecture.length;
  const layerSpacing = width / (numLayers + 1);
  const positions: NeuronPosition[][] = [];

  for (let layerIdx = 0; layerIdx < numLayers; layerIdx++) {
    const neuronCount = architecture[layerIdx];
    const x = layerSpacing * (layerIdx + 1);
    const layerHeight =
      (neuronCount - 1) * (neuronRadius * LAYOUT.neuronSpacingMultiplier);
    const startY = (height - layerHeight) / 2;

    const layerPositions: NeuronPosition[] = [];
    for (let neuronIdx = 0; neuronIdx < neuronCount; neuronIdx++) {
      const y =
        startY + neuronIdx * (neuronRadius * LAYOUT.neuronSpacingMultiplier);
      layerPositions.push({ x, y });
    }
    positions.push(layerPositions);
  }

  return positions;
}

/**
 * Checks if a point is near a line segment within a given threshold.
 */
function isPointNearLine(
  px: number,
  py: number,
  from: NeuronPosition,
  to: NeuronPosition,
  threshold: number,
): boolean {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const lengthSquared = dx * dx + dy * dy;

  if (lengthSquared === 0) {
    // Line segment is a point
    const dist = Math.sqrt((px - from.x) ** 2 + (py - from.y) ** 2);
    return dist <= threshold;
  }

  // Calculate projection of point onto line segment
  let t = ((px - from.x) * dx + (py - from.y) * dy) / lengthSquared;
  t = Math.max(0, Math.min(1, t));

  // Find closest point on line segment
  const closestX = from.x + t * dx;
  const closestY = from.y + t * dy;

  // Calculate distance from point to closest point on line
  const distance = Math.sqrt((px - closestX) ** 2 + (py - closestY) ** 2);
  return distance <= threshold;
}

/**
 * Canvas-based neural network visualization.
 * Renders neurons, connections with weights, and layer labels.
 */
export const NetworkCanvas = ({
  architecture,
  activations,
  weights,
  biases,
  onWeightChange,
  onBiasChange,
}: NetworkCanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hoveredNeuron, setHoveredNeuron] = useState<HoveredNeuron | null>(
    null,
  );
  const [hoveredConnection, setHoveredConnection] =
    useState<HoveredConnection | null>(null);
  const [mousePosition, setMousePosition] = useState<MousePosition | null>(
    null,
  );
  const neuronPositionsRef = useRef<NeuronPosition[][]>([]);
  const neuronRadiusRef = useRef<number>(0);

  // Draw the canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Setup canvas dimensions with device pixel ratio for crisp rendering
    const rect = canvas.getBoundingClientRect();
    const { width, height } = rect;

    canvas.width = width * window.devicePixelRatio;
    canvas.height = height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    ctx.clearRect(0, 0, width, height);

    // Calculate layout parameters
    const numLayers = architecture.length;
    const maxNeurons = Math.max(...architecture);
    const neuronRadius = Math.min(
      LAYOUT.maxNeuronRadius,
      height / (maxNeurons * LAYOUT.neuronRadiusDivisor),
    );

    // Store for hover detection
    neuronRadiusRef.current = neuronRadius;

    // Calculate neuron positions using helper function
    const neuronPositions = calculateNeuronPositions(
      architecture,
      width,
      height,
      neuronRadius,
    );
    neuronPositionsRef.current = neuronPositions;

    // Draw all connections (weights) between layers
    drawConnections(
      ctx,
      neuronPositions,
      weights,
      numLayers,
      hoveredConnection,
      mousePosition,
    );

    // Draw all neurons
    drawNeurons(
      ctx,
      neuronPositions,
      activations,
      biases,
      neuronRadius,
      numLayers,
      hoveredNeuron,
      mousePosition,
    );
  }, [
    architecture,
    weights,
    activations,
    biases,
    hoveredNeuron,
    hoveredConnection,
    mousePosition,
  ]);

  // Handle mouse move for hover detection
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const radius = neuronRadiusRef.current;

      // Check if mouse is over any neuron first
      for (
        let layerIdx = 0;
        layerIdx < neuronPositionsRef.current.length;
        layerIdx++
      ) {
        const layer = neuronPositionsRef.current[layerIdx];
        for (let neuronIdx = 0; neuronIdx < layer.length; neuronIdx++) {
          const neuron = layer[neuronIdx];
          const distance = Math.sqrt((x - neuron.x) ** 2 + (y - neuron.y) ** 2);
          if (distance <= radius) {
            setHoveredNeuron({ layerIdx, neuronIdx });
            setHoveredConnection(null);
            setMousePosition({ x, y });
            return;
          }
        }
      }

      // Check if mouse is over any connection
      const positions = neuronPositionsRef.current;
      for (let layerIdx = 0; layerIdx < positions.length - 1; layerIdx++) {
        const fromLayer = positions[layerIdx];
        const toLayer = positions[layerIdx + 1];

        for (let fromIdx = 0; fromIdx < fromLayer.length; fromIdx++) {
          for (let toIdx = 0; toIdx < toLayer.length; toIdx++) {
            const from = fromLayer[fromIdx];
            const to = toLayer[toIdx];

            if (isPointNearLine(x, y, from, to, 5)) {
              setHoveredConnection({ layerIdx, fromIdx, toIdx });
              setHoveredNeuron(null);
              setMousePosition({ x, y });
              return;
            }
          }
        }
      }

      setHoveredNeuron(null);
      setHoveredConnection(null);
      setMousePosition(null);
    },
    [],
  );

  const handleMouseLeave = useCallback(() => {
    setHoveredNeuron(null);
    setHoveredConnection(null);
    setMousePosition(null);
  }, []);

  // Focus canvas on mouse enter so keyboard events work
  const handleMouseEnter = useCallback(() => {
    canvasRef.current?.focus();
  }, []);

  // Handle scroll to change weight or bias values
  // Normal scroll: step of 0.1, Shift+scroll: step of 0.01
  const handleWheel = useCallback(
    (e: React.WheelEvent<HTMLCanvasElement>) => {
      const LARGE_STEP = 0.1;
      const SMALL_STEP = 0.01;
      const step = e.shiftKey ? SMALL_STEP : LARGE_STEP;
      const delta = e.deltaY > 0 ? -step : step;

      // Handle connection (weight) scroll
      if (hoveredConnection && onWeightChange) {
        e.preventDefault();
        const { layerIdx, fromIdx, toIdx } = hoveredConnection;
        const currentWeight = weights?.[layerIdx]?.[fromIdx]?.[toIdx] ?? 0;
        // Round to 2 decimal places, then apply delta
        const roundedCurrent = Math.round(currentWeight * 100) / 100;
        const newValue = Math.max(-1, Math.min(1, roundedCurrent + delta));
        onWeightChange(layerIdx, fromIdx, toIdx, newValue);
      }

      // Handle neuron (bias) scroll - only for hidden and output layers (layerIdx > 0)
      if (hoveredNeuron && onBiasChange && hoveredNeuron.layerIdx > 0) {
        e.preventDefault();
        const { layerIdx, neuronIdx } = hoveredNeuron;
        // biases array is indexed by layerIdx - 1 (no bias for input layer)
        const currentBias = biases?.[layerIdx - 1]?.[neuronIdx] ?? 0;
        // Round to 2 decimal places, then apply delta
        const roundedCurrent = Math.round(currentBias * 100) / 100;
        const newValue = Math.max(-1, Math.min(1, roundedCurrent + delta));
        onBiasChange(layerIdx - 1, neuronIdx, newValue);
      }
    },
    [
      hoveredConnection,
      hoveredNeuron,
      weights,
      biases,
      onWeightChange,
      onBiasChange,
    ],
  );

  // Handle keyboard input for direct value setting (0 or 1)
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLCanvasElement>) => {
      if (e.key !== "0" && e.key !== "1") return;
      const value = e.key === "0" ? 0 : 1;

      // Handle connection (weight) direct value
      if (hoveredConnection && onWeightChange) {
        const { layerIdx, fromIdx, toIdx } = hoveredConnection;
        onWeightChange(layerIdx, fromIdx, toIdx, value);
      }

      // Handle neuron (bias) direct value - only for hidden and output layers (layerIdx > 0)
      if (hoveredNeuron && onBiasChange && hoveredNeuron.layerIdx > 0) {
        const { layerIdx, neuronIdx } = hoveredNeuron;
        onBiasChange(layerIdx - 1, neuronIdx, value);
      }
    },
    [hoveredConnection, hoveredNeuron, onWeightChange, onBiasChange],
  );

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full"
      style={{ minHeight: "50vh", outline: "none" }}
      tabIndex={0}
      onMouseEnter={handleMouseEnter}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onWheel={handleWheel}
      onKeyDown={handleKeyDown}
    />
  );
};

// ============================================================================
// Canvas Drawing Functions
// ============================================================================

/**
 * Draws connections (weight lines) between layers.
 * Shows weight value at mouse position when connection is hovered.
 */
function drawConnections(
  ctx: CanvasRenderingContext2D,
  neuronPositions: NeuronPosition[][],
  weights: number[][][] | null,
  numLayers: number,
  hoveredConnection: HoveredConnection | null,
  mousePosition: MousePosition | null,
): void {
  for (let layerIdx = 0; layerIdx < numLayers - 1; layerIdx++) {
    const fromLayer = neuronPositions[layerIdx];
    const toLayer = neuronPositions[layerIdx + 1];
    const layerWeights = weights?.[layerIdx];

    for (let fromIdx = 0; fromIdx < fromLayer.length; fromIdx++) {
      for (let toIdx = 0; toIdx < toLayer.length; toIdx++) {
        const from = fromLayer[fromIdx];
        const to = toLayer[toIdx];
        const weight = layerWeights?.[fromIdx]?.[toIdx] ?? 0;
        const isHovered =
          hoveredConnection?.layerIdx === layerIdx &&
          hoveredConnection?.fromIdx === fromIdx &&
          hoveredConnection?.toIdx === toIdx;

        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x, to.y);
        ctx.strokeStyle = getWeightColor(weight);
        ctx.lineWidth = isHovered
          ? getWeightLineWidth(weight) * 2
          : getWeightLineWidth(weight);
        ctx.stroke();

        // Draw weight value at mouse position when hovered
        if (isHovered && mousePosition) {
          ctx.fillStyle = COLORS.labelText;
          ctx.font = LAYOUT.labelFontSize;
          ctx.textAlign = "left";
          ctx.textBaseline = "bottom";
          ctx.fillText(
            weight.toFixed(2),
            mousePosition.x + 10,
            mousePosition.y - 5,
          );
        }
      }
    }
  }
}

/**
 * Draws neurons as filled circles with strokes.
 * Shows bias value at mouse position when neuron is hovered.
 */
function drawNeurons(
  ctx: CanvasRenderingContext2D,
  neuronPositions: NeuronPosition[][],
  activations: number[][] | null,
  biases: number[][] | null,
  neuronRadius: number,
  numLayers: number,
  hoveredNeuron: HoveredNeuron | null,
  mousePosition: MousePosition | null,
): void {
  for (let layerIdx = 0; layerIdx < numLayers; layerIdx++) {
    const layer = neuronPositions[layerIdx];
    const layerActivations = activations?.[layerIdx];
    const layerBiases = biases?.[layerIdx - 1];

    for (let neuronIdx = 0; neuronIdx < layer.length; neuronIdx++) {
      const { x, y } = layer[neuronIdx];
      const activation = layerActivations?.[neuronIdx] ?? 0;
      const isHovered =
        hoveredNeuron?.layerIdx === layerIdx &&
        hoveredNeuron?.neuronIdx === neuronIdx;

      ctx.beginPath();
      ctx.arc(x, y, neuronRadius, 0, Math.PI * 2);
      ctx.fillStyle = getNeuronFillColor(activation);
      ctx.fill();
      ctx.strokeStyle = COLORS.neuronStroke;
      ctx.lineWidth = isHovered ? LAYOUT.strokeWidth * 2 : LAYOUT.strokeWidth;
      ctx.stroke();

      // Draw bias value at mouse position when hovered (for hidden and output layers)
      if (isHovered && layerBiases && mousePosition) {
        const bias = layerBiases[neuronIdx]?.toFixed(2) ?? "";
        ctx.fillStyle = COLORS.labelText;
        ctx.font = LAYOUT.labelFontSize;
        ctx.textAlign = "left";
        ctx.textBaseline = "bottom";
        // Offset slightly from cursor so it doesn't overlap
        ctx.fillText(bias, mousePosition.x + 10, mousePosition.y - 5);
      }
    }
  }
}
