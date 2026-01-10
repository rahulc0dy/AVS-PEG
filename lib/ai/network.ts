import { Level, LevelJson } from "@/lib/ai/level";
import { getRandomNumberBetween, lerp } from "@/utils/math";

/**
 * JSON representation of a NeuralNetwork for serialization.
 */
export interface NeuralNetworkJson {
  levels: LevelJson[];
}

export class NeuralNetwork {
  levels: Level[];
  constructor(neuronCounts: number[]) {
    this.levels = [];
    for (let i = 0; i < neuronCounts.length - 1; i++) {
      this.levels.push(new Level(neuronCounts[i], neuronCounts[i + 1]));
    }
  }

  decide(givenInputs: number[]) {
    return NeuralNetwork.feedForward(givenInputs, this);
  }

  /**
   * Serialize the neural network to a JSON object.
   */
  toJson(): NeuralNetworkJson {
    return {
      levels: this.levels.map((level) => level.toJson()),
    };
  }

  /**
   * Load the neural network state from a JSON object.
   */
  fromJson(json: NeuralNetworkJson): void {
    this.levels = json.levels.map((levelJson) => Level.fromJson(levelJson));
  }

  /**
   * Create a NeuralNetwork from a JSON object.
   */
  static fromJson(json: NeuralNetworkJson): NeuralNetwork {
    // Create a dummy network, then replace its levels
    const network = new NeuralNetwork([1, 1]); // Minimal placeholder
    network.levels = json.levels.map((levelJson) => Level.fromJson(levelJson));
    return network;
  }

  static feedForward(givenInputs: number[], network: NeuralNetwork) {
    let outputs = Level.feedForward(givenInputs, network.levels[0]);
    for (let i = 1; i < network.levels.length; i++) {
      outputs = Level.feedForward(outputs, network.levels[i]);
    }
    return outputs;
  }

  static mutate(network: NeuralNetwork, amount = 1) {
    network.levels.forEach((level) => {
      for (let i = 0; i < level.biases.length; i++) {
        level.biases[i] = lerp(
          level.biases[i],
          getRandomNumberBetween(-1, 1),
          amount,
        );
      }
      for (let i = 0; i < level.weights.length; i++) {
        for (let j = 0; j < level.weights[i].length; j++) {
          level.weights[i][j] = lerp(
            level.weights[i][j],
            Math.random() * 2 - 1,
            amount,
          );
        }
      }
    });
  }
}
