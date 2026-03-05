import React, { useCallback, useEffect, useRef, useState } from "react";
import { clamp } from "@/utils/math";

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

function getWeightColor(weight: number): string {
  const normalized = clamp(weight, -1, 1);
  const alpha = Math.abs(normalized) * 0.6 + 0.1;
  const intensity = Math.floor(Math.abs(normalized) * 200 + 55);
  return normalized > 0
    ? `rgba(55, ${intensity}, 100, ${alpha})`
    : `rgba(${intensity}, 55, 100, ${alpha})`;
}

function getWeightLineWidth(weight: number): number {
  return Math.abs(clamp(weight, -1, 1)) * 2 + 0.5;
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
  return architecture.map((neuronCount, layerIndex) => {
    const x = layerSpacing * (layerIndex + 1);
    const layerHeight = (neuronCount - 1) * radius * LAYOUT.spacingMultiplier;
    const startY = (height - layerHeight) / 2;
    return Array.from({ length: neuronCount }, (_, neuronIndex) => ({
      x,
      y: startY + neuronIndex * radius * LAYOUT.spacingMultiplier,
    }));
  });
}

function distSq(pointA: Point, pointB: Point): number {
  return (pointA.x - pointB.x) ** 2 + (pointA.y - pointB.y) ** 2;
}

function isPointNearLine(
  point: Point,
  lineStart: Point,
  lineEnd: Point,
  threshold: number,
): boolean {
  const deltaX = lineEnd.x - lineStart.x;
  const deltaY = lineEnd.y - lineStart.y;
  const lengthSq = deltaX * deltaX + deltaY * deltaY;
  if (lengthSq === 0) return distSq(point, lineStart) <= threshold * threshold;
  const projection = clamp(
    ((point.x - lineStart.x) * deltaX + (point.y - lineStart.y) * deltaY) /
      lengthSq,
    0,
    1,
  );
  return (
    distSq(point, {
      x: lineStart.x + projection * deltaX,
      y: lineStart.y + projection * deltaY,
    }) <=
    threshold * threshold
  );
}

function drawTooltip(
  ctx: CanvasRenderingContext2D,
  text: string,
  position: Point,
) {
  ctx.fillStyle = COLORS.labelText;
  ctx.font = LAYOUT.font;
  ctx.textAlign = "left";
  ctx.textBaseline = "bottom";
  ctx.fillText(text, position.x + 10, position.y - 5);
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

function drawConnections(
  ctx: CanvasRenderingContext2D,
  positions: Point[][],
  architecture: number[],
  weights: number[][][] | null,
  hover: HoverTarget | null,
  mousePos: Point | null,
) {
  for (let layerIndex = 0; layerIndex < architecture.length - 1; layerIndex++) {
    for (
      let fromIndex = 0;
      fromIndex < positions[layerIndex].length;
      fromIndex++
    ) {
      for (
        let toIndex = 0;
        toIndex < positions[layerIndex + 1].length;
        toIndex++
      ) {
        const fromPos = positions[layerIndex][fromIndex];
        const toPos = positions[layerIndex + 1][toIndex];
        const weight = weights?.[layerIndex]?.[fromIndex]?.[toIndex] ?? 0;
        const isHovered =
          hover?.type === "connection" &&
          hover.layerIdx === layerIndex &&
          hover.fromIdx === fromIndex &&
          hover.toIdx === toIndex;

        ctx.beginPath();
        ctx.moveTo(fromPos.x, fromPos.y);
        ctx.lineTo(toPos.x, toPos.y);
        ctx.strokeStyle = getWeightColor(weight);
        ctx.lineWidth = getWeightLineWidth(weight) * (isHovered ? 2 : 1);
        ctx.stroke();

        if (isHovered && mousePos)
          drawTooltip(ctx, weight.toFixed(2), mousePos);
      }
    }
  }
}

function drawNeurons(
  ctx: CanvasRenderingContext2D,
  positions: Point[][],
  architecture: number[],
  radius: number,
  activations: number[][] | null,
  biases: number[][] | null,
  hover: HoverTarget | null,
  mousePos: Point | null,
  inputLabels?: string[],
  outputLabels?: string[],
) {
  const lastLayerIndex = architecture.length - 1;

  for (let layerIndex = 0; layerIndex < architecture.length; layerIndex++) {
    for (
      let neuronIndex = 0;
      neuronIndex < positions[layerIndex].length;
      neuronIndex++
    ) {
      const { x, y } = positions[layerIndex][neuronIndex];
      const activation = activations?.[layerIndex]?.[neuronIndex] ?? 0;
      const isHovered =
        hover?.type === "neuron" &&
        hover.layerIdx === layerIndex &&
        hover.neuronIdx === neuronIndex;

      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fillStyle = getNeuronFillColor(activation);
      ctx.fill();
      ctx.strokeStyle = COLORS.neuronStroke;
      ctx.lineWidth = LAYOUT.strokeWidth * (isHovered ? 2 : 1);
      ctx.stroke();

      if (isHovered && mousePos) {
        const bias =
          layerIndex > 0 ? biases?.[layerIndex - 1]?.[neuronIndex] : undefined;
        const label =
          bias != null
            ? `val: ${activation.toFixed(2)}  bias: ${bias.toFixed(2)}`
            : activation.toFixed(2);
        drawTooltip(ctx, label, mousePos);
      }

      if (layerIndex === 0 && inputLabels?.[neuronIndex]) {
        drawLabel(
          ctx,
          inputLabels[neuronIndex],
          x - radius - LAYOUT.labelOffset,
          y,
          "right",
        );
      }

      if (layerIndex === lastLayerIndex && outputLabels?.[neuronIndex]) {
        drawLabel(
          ctx,
          outputLabels[neuronIndex],
          x + radius + LAYOUT.labelOffset,
          y,
          "left",
        );
      }
    }
  }
}

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

    drawConnections(ctx, positions, architecture, weights, hover, mousePos);
    drawNeurons(
      ctx,
      positions,
      architecture,
      radius,
      activations,
      biases,
      hover,
      mousePos,
      inputLabels,
      outputLabels,
    );
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
      const cursorPosition: Point = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
      const radius = radiusRef.current;
      const positions = positionsRef.current;

      // Check neurons
      for (let layerIndex = 0; layerIndex < positions.length; layerIndex++) {
        for (
          let neuronIndex = 0;
          neuronIndex < positions[layerIndex].length;
          neuronIndex++
        ) {
          if (
            distSq(cursorPosition, positions[layerIndex][neuronIndex]) <=
            radius * radius
          ) {
            setHover({
              type: "neuron",
              layerIdx: layerIndex,
              neuronIdx: neuronIndex,
            });
            setMousePos(cursorPosition);
            return;
          }
        }
      }

      // Check connections
      for (
        let layerIndex = 0;
        layerIndex < positions.length - 1;
        layerIndex++
      ) {
        for (
          let fromIndex = 0;
          fromIndex < positions[layerIndex].length;
          fromIndex++
        ) {
          for (
            let toIndex = 0;
            toIndex < positions[layerIndex + 1].length;
            toIndex++
          ) {
            if (
              isPointNearLine(
                cursorPosition,
                positions[layerIndex][fromIndex],
                positions[layerIndex + 1][toIndex],
                5,
              )
            ) {
              setHover({
                type: "connection",
                layerIdx: layerIndex,
                fromIdx: fromIndex,
                toIdx: toIndex,
              });
              setMousePos(cursorPosition);
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
        const currentWeight =
          Math.round((weights?.[layerIdx]?.[fromIdx]?.[toIdx] ?? 0) * 100) /
          100;
        onWeightChange(
          layerIdx,
          fromIdx,
          toIdx,
          clamp(currentWeight + delta, -1, 1),
        );
      }

      if (hover?.type === "neuron" && hover.layerIdx > 0 && onBiasChange) {
        e.preventDefault();
        const { layerIdx, neuronIdx } = hover;
        const currentBias =
          Math.round((biases?.[layerIdx - 1]?.[neuronIdx] ?? 0) * 100) / 100;
        onBiasChange(
          layerIdx - 1,
          neuronIdx,
          clamp(currentBias + delta, -1, 1),
        );
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
