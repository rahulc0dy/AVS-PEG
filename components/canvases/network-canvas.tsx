import React, { useCallback, useEffect, useRef, useState } from "react";

// ============================================================================
// Types
// ============================================================================

interface NetworkCanvasProps {
  architecture: number[];
  activations: number[][] | null;
  weights: number[][][] | null;
  biases: number[][] | null;
  inputLabels?: string[];
  outputLabels?: string[];
  onWeightChange?: (
    layerIdx: number,
    fromIdx: number,
    toIdx: number,
    value: number,
  ) => void;
  onBiasChange?: (layerIdx: number, neuronIdx: number, value: number) => void;
}

interface Point {
  x: number;
  y: number;
}

type HoverTarget =
  | { type: "neuron"; layerIdx: number; neuronIdx: number }
  | { type: "connection"; layerIdx: number; fromIdx: number; toIdx: number };

// ============================================================================
// Constants
// ============================================================================

const COLORS = {
  neuronStroke: "#a1a1aa",
  labelText: "#ffffff",
  inactiveNeuron: "rgb(80, 80, 80)",
} as const;

const LAYOUT = {
  maxNeuronRadius: 1600,
  spacingMultiplier: 3,
  radiusDivisor: 4,
  strokeWidth: 1.5,
  font: "14px sans-serif",
  labelOffset: 8,
} as const;

// ============================================================================
// Helpers
// ============================================================================

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

function getWeightColor(w: number): string {
  const n = clamp(w, -1, 1);
  const alpha = Math.abs(n) * 0.6 + 0.1;
  const intensity = Math.floor(Math.abs(n) * 200 + 55);
  return n > 0
    ? `rgba(55, ${intensity}, 100, ${alpha})`
    : `rgba(${intensity}, 55, 100, ${alpha})`;
}

function getWeightLineWidth(w: number): number {
  return Math.abs(clamp(w, -1, 1)) * 2 + 0.5;
}

function getNeuronFillColor(activation: number): string {
  return activation > 0.5
    ? `rgb(55, ${Math.floor(activation * 200 + 55)}, 100)`
    : COLORS.inactiveNeuron;
}

function computePositions(
  architecture: number[],
  width: number,
  height: number,
  radius: number,
): Point[][] {
  const layerSpacing = width / (architecture.length + 1);
  return architecture.map((count, i) => {
    const x = layerSpacing * (i + 1);
    const layerHeight = (count - 1) * radius * LAYOUT.spacingMultiplier;
    const startY = (height - layerHeight) / 2;
    return Array.from({ length: count }, (_, j) => ({
      x,
      y: startY + j * radius * LAYOUT.spacingMultiplier,
    }));
  });
}

function distSq(a: Point, b: Point): number {
  return (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
}

function isPointNearLine(
  p: Point,
  a: Point,
  b: Point,
  threshold: number,
): boolean {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return distSq(p, a) <= threshold * threshold;
  const t = clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq, 0, 1);
  return (
    distSq(p, { x: a.x + t * dx, y: a.y + t * dy }) <= threshold * threshold
  );
}

function drawTooltip(ctx: CanvasRenderingContext2D, text: string, pos: Point) {
  ctx.fillStyle = COLORS.labelText;
  ctx.font = LAYOUT.font;
  ctx.textAlign = "left";
  ctx.textBaseline = "bottom";
  ctx.fillText(text, pos.x + 10, pos.y - 5);
}

function drawLabel(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  align: CanvasTextAlign,
) {
  ctx.fillStyle = COLORS.labelText;
  ctx.font = LAYOUT.font;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.fillText(text, x, y);
}

// ============================================================================
// Component
// ============================================================================

export const NetworkCanvas = ({
  architecture,
  activations,
  weights,
  biases,
  inputLabels,
  outputLabels,
  onWeightChange,
  onBiasChange,
}: NetworkCanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hover, setHover] = useState<HoverTarget | null>(null);
  const [mousePos, setMousePos] = useState<Point | null>(null);
  const positionsRef = useRef<Point[][]>([]);
  const radiusRef = useRef(0);

  // Draw the canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const { width, height } = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    const maxNeurons = Math.max(...architecture);
    const radius = Math.min(
      LAYOUT.maxNeuronRadius,
      height / (maxNeurons * LAYOUT.radiusDivisor),
    );
    radiusRef.current = radius;

    const positions = computePositions(architecture, width, height, radius);
    positionsRef.current = positions;

    // Draw connections
    for (let li = 0; li < architecture.length - 1; li++) {
      for (let fi = 0; fi < positions[li].length; fi++) {
        for (let ti = 0; ti < positions[li + 1].length; ti++) {
          const from = positions[li][fi];
          const to = positions[li + 1][ti];
          const w = weights?.[li]?.[fi]?.[ti] ?? 0;
          const isHovered =
            hover?.type === "connection" &&
            hover.layerIdx === li &&
            hover.fromIdx === fi &&
            hover.toIdx === ti;

          ctx.beginPath();
          ctx.moveTo(from.x, from.y);
          ctx.lineTo(to.x, to.y);
          ctx.strokeStyle = getWeightColor(w);
          ctx.lineWidth = getWeightLineWidth(w) * (isHovered ? 2 : 1);
          ctx.stroke();

          if (isHovered && mousePos) drawTooltip(ctx, w.toFixed(2), mousePos);
        }
      }
    }

    // Draw neurons
    const lastLayer = architecture.length - 1;
    for (let li = 0; li < architecture.length; li++) {
      for (let ni = 0; ni < positions[li].length; ni++) {
        const { x, y } = positions[li][ni];
        const activation = activations?.[li]?.[ni] ?? 0;
        const isHovered =
          hover?.type === "neuron" &&
          hover.layerIdx === li &&
          hover.neuronIdx === ni;

        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fillStyle = getNeuronFillColor(activation);
        ctx.fill();
        ctx.strokeStyle = COLORS.neuronStroke;
        ctx.lineWidth = LAYOUT.strokeWidth * (isHovered ? 2 : 1);
        ctx.stroke();

        // Value tooltip on hover: activation for all neurons, plus bias for non-input layers
        if (isHovered && mousePos) {
          const bias = li > 0 ? biases?.[li - 1]?.[ni] : undefined;
          const label =
            bias != null
              ? `val: ${activation.toFixed(2)}  bias: ${bias.toFixed(2)}`
              : activation.toFixed(2);
          drawTooltip(ctx, label, mousePos);
        }

        // Input labels (left of first layer)
        if (li === 0 && inputLabels?.[ni]) {
          drawLabel(ctx, inputLabels[ni], x - radius - LAYOUT.labelOffset, y, "right");
        }

        // Output labels (right of last layer)
        if (li === lastLayer && outputLabels?.[ni]) {
          drawLabel(ctx, outputLabels[ni], x + radius + LAYOUT.labelOffset, y, "left");
        }
      }
    }
  }, [
    architecture,
    weights,
    activations,
    biases,
    hover,
    mousePos,
    inputLabels,
    outputLabels,
  ]);

  // Hover detection
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const p: Point = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      const r = radiusRef.current;
      const positions = positionsRef.current;

      // Check neurons
      for (let li = 0; li < positions.length; li++) {
        for (let ni = 0; ni < positions[li].length; ni++) {
          if (distSq(p, positions[li][ni]) <= r * r) {
            setHover({ type: "neuron", layerIdx: li, neuronIdx: ni });
            setMousePos(p);
            return;
          }
        }
      }

      // Check connections
      for (let li = 0; li < positions.length - 1; li++) {
        for (let fi = 0; fi < positions[li].length; fi++) {
          for (let ti = 0; ti < positions[li + 1].length; ti++) {
            if (
              isPointNearLine(p, positions[li][fi], positions[li + 1][ti], 5)
            ) {
              setHover({
                type: "connection",
                layerIdx: li,
                fromIdx: fi,
                toIdx: ti,
              });
              setMousePos(p);
              return;
            }
          }
        }
      }

      setHover(null);
      setMousePos(null);
    },
    [],
  );

  const handleMouseLeave = useCallback(() => {
    setHover(null);
    setMousePos(null);
  }, []);

  // Scroll to adjust weight or bias (Shift+scroll for fine control)
  const handleWheel = useCallback(
    (e: React.WheelEvent<HTMLCanvasElement>) => {
      const step = e.shiftKey ? 0.01 : 0.1;
      const delta = e.deltaY > 0 ? -step : step;

      if (hover?.type === "connection" && onWeightChange) {
        e.preventDefault();
        const { layerIdx, fromIdx, toIdx } = hover;
        const cur =
          Math.round((weights?.[layerIdx]?.[fromIdx]?.[toIdx] ?? 0) * 100) /
          100;
        onWeightChange(layerIdx, fromIdx, toIdx, clamp(cur + delta, -1, 1));
      }

      if (hover?.type === "neuron" && hover.layerIdx > 0 && onBiasChange) {
        e.preventDefault();
        const { layerIdx, neuronIdx } = hover;
        const cur =
          Math.round((biases?.[layerIdx - 1]?.[neuronIdx] ?? 0) * 100) / 100;
        onBiasChange(layerIdx - 1, neuronIdx, clamp(cur + delta, -1, 1));
      }
    },
    [hover, weights, biases, onWeightChange, onBiasChange],
  );

  // Press 0 or 1 to set value directly
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLCanvasElement>) => {
      if (e.key !== "0" && e.key !== "1") return;
      const value = Number(e.key);

      if (hover?.type === "connection" && onWeightChange) {
        const { layerIdx, fromIdx, toIdx } = hover;
        onWeightChange(layerIdx, fromIdx, toIdx, value);
      }

      if (hover?.type === "neuron" && hover.layerIdx > 0 && onBiasChange) {
        onBiasChange(hover.layerIdx - 1, hover.neuronIdx, value);
      }
    },
    [hover, onWeightChange, onBiasChange],
  );

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full"
      style={{ minHeight: "50vh", outline: "none" }}
      tabIndex={0}
      onMouseEnter={() => canvasRef.current?.focus()}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onWheel={handleWheel}
      onKeyDown={handleKeyDown}
    />
  );
};