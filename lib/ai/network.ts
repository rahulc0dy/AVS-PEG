import {Level} from "@/lib/ai/level";
import {getRandomNumberBetween, lerp} from "@/utils/math";
import {NeuralNetworkJson, NeuralNetworkStateJson} from "@/types/save";

/**
 * A feedforward neural network for AI decision-making.
 *
 * Architecture:
 * - Multiple layers (levels) connected sequentially
 * - Each layer performs weighted sum + threshold activation
 * - Supports serialization for saving/loading trained networks
 * - Supports mutation for evolutionary training
 */
export class NeuralNetwork {
  /** Array of network layers */
  levels: Level[];

  /**
   * Create a new neural network with the specified architecture.
   *
   * @param neuronCounts Array specifying neurons per layer.
   *   Example: [14, 8, 4] creates a network with:
   *   - 14 input neurons
   *   - 8 hidden neurons
   *   - 4 output neurons
   */
  constructor(neuronCounts: number[]) {
    this.levels = [];
    for (let i = 0; i < neuronCounts.length - 1; i++) {
      this.levels.push(new Level(neuronCounts[i], neuronCounts[i + 1]));
    }
  }

  /**
   * Create a NeuralNetwork from a JSON object.
   */
  static fromJson(json: NeuralNetworkJson): NeuralNetwork {
    const network = new NeuralNetwork([1, 1]); // Placeholder
    network.levels = json.levels.map((levelJson) => Level.fromJson(levelJson));
    return network;
  }

  /**
   * Perform forward propagation through the entire network.
   *
   * @param inputs Input values
   * @param network Network to process through
   * @returns Final output values
   */
  static feedForward(inputs: number[], network: NeuralNetwork): number[] {
    let outputs = Level.feedForward(inputs, network.levels[0]);
    for (let i = 1; i < network.levels.length; i++) {
      outputs = Level.feedForward(outputs, network.levels[i]);
    }
    return outputs;
  }

  /**
   * Apply random mutations to the network's weights and biases.
   *
   * Uses linear interpolation between current values and random values.
   *
   * @param network Network to mutate (modified in place)
   * @param amount Mutation strength: 0 = no change, 1 = fully random
   */
  static mutate(network: NeuralNetwork, amount: number = 1): void {
    for (const level of network.levels) {
      // Mutate biases
      for (let i = 0; i < level.biases.length; i++) {
        level.biases[i] = lerp(
          level.biases[i],
          getRandomNumberBetween(-1, 1),
          amount,
        );
      }

      // Mutate weights
      for (let i = 0; i < level.weights.length; i++) {
        for (let j = 0; j < level.weights[i].length; j++) {
          level.weights[i][j] = lerp(
            level.weights[i][j],
            getRandomNumberBetween(-1, 1),
            amount,
          );
        }
      }
    }
  }

  /**
   * Make a decision based on input values.
   *
   * @param inputs Array of input values (must match input layer size)
   * @returns Array of output values (binary: 0 or 1)
   */
  decide(inputs: number[]): number[] {
    return NeuralNetwork.feedForward(inputs, this);
  }

  /**
   * Get the expected number of inputs for this network.
   */
  getInputCount(): number {
    return this.levels[0]?.inputs.length ?? 0;
  }

  /**
   * Get the expected number of outputs for this network.
   */
  getOutputCount(): number {
    const lastLevel = this.levels[this.levels.length - 1];
    return lastLevel?.outputs.length ?? 0;
  }

  /**
   * Get the current state of the network for visualization.
   * Call this after decide() to get the latest activations.
   */
  getState(): NeuralNetworkStateJson {
    const firstLevel = this.levels[0];
    const lastLevel = this.levels[this.levels.length - 1];

    return {
      inputs: firstLevel ? [...firstLevel.inputs] : [],
      outputs: lastLevel ? [...lastLevel.outputs] : [],
      levels: this.levels.map((level) => level.getState()),
    };
  }

  /**
   * Serialize the neural network to a JSON object.
   */
  toJson(): NeuralNetworkJson {
    return {
      levels: this.levels.map((level) => level.toJson()),
    };
  }
}
