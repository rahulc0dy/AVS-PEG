"use client";

import React, { useMemo } from "react";
import Image from "next/image";
import { NeuralNetworkStateJson } from "@/types/car/state";
import { SlideablePanel } from "@/components/ui/slideable-panel";
import { NetworkCanvas } from "@/components/canvases/network-canvas";
import { getNetworkHiddenLabels, NeuronLabel } from "@/lib/car/network-config";

interface NeuralNetworkVisualizerProps {
  state?: NeuralNetworkStateJson | null;
  /** Labels displayed beside each input-layer neuron. */
  inputLabels?: NeuronLabel[];
  /** Labels displayed beside each output-layer neuron. */
  outputLabels?: NeuronLabel[];
  onWeightChange?: (
    layerIdx: number,
    fromIdx: number,
    toIdx: number,
    value: number,
  ) => void;
  onBiasChange?: (layerIdx: number, neuronIdx: number, value: number) => void;
}

/**
 * Bottom slideable panel that visualizes a neural network.
 * Shows neurons as circles and connections as lines with weights.
 */
export const NeuralNetworkVisualizer = ({
  state,
  inputLabels,
  outputLabels,
  onWeightChange,
  onBiasChange,
}: NeuralNetworkVisualizerProps) => {
  const networkData = useMemo(() => {
    if (!state || state.levels.length === 0) return null;
    return {
      architecture: [
        state.levels[0].inputs.length,
        ...state.levels.map((l) => l.outputs.length),
      ],
      activations: [state.inputs, ...state.levels.map((l) => l.outputs)],
      weights: state.levels.map((l) => l.weights),
      biases: state.levels.map((l) => l.biases),
    };
  }, [state]);

  const hiddenLabels = useMemo(() => getNetworkHiddenLabels(), []);

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
      expandedSize="50vh"
    >
      {!state ? (
        <div className="h-full flex items-center justify-center">
          <p className="text-zinc-500 text-sm">
            No neural network available. Spawn cars to visualize.
          </p>
        </div>
      ) : networkData ? (
        <NetworkCanvas
          {...networkData}
          inputLabels={inputLabels}
          outputLabels={outputLabels}
          hiddenLabels={hiddenLabels}
          onWeightChange={onWeightChange}
          onBiasChange={onBiasChange}
        />
      ) : null}
    </SlideablePanel>
  );
};
