"use client";

import React, { useMemo } from "react";
import Image from "next/image";
import { NeuralNetworkStateJson } from "@/types/car/state";
import { SlideablePanel } from "@/components/ui/slideable-panel";
import { NetworkCanvas } from "@/components/canvases/network-canvas";

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

  const biases = useMemo(() => {
    if (!state) return null;
    return state.levels.map((level) => level.biases);
  }, [state]);

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
      expandedSize="50vh"
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
          biases={biases}
        />
      ) : null}
    </SlideablePanel>
  );
};
