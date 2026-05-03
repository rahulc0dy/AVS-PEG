import { getRandomNumberBetween } from "@/utils/math";
import { LevelJson } from "@/types/save";
import { LevelStateJson } from "@/types/car/state";

/**
 * A single layer in a neural network.
 *
 * Each level connects inputs to outputs through weighted connections.
 * Supports sigmoid or step activation function per layer.
 */
export class Level {
  /** Input values for this layer */
  inputs: number[];
  /** Output values after activation */
  outputs: number[];
  /** Bias values for each output neuron */
  biases: number[];
  /** Weight matrix [inputIndex][outputIndex] */
  weights: number[][];
  /** Whether to use sigmoid (true) or step function (false) */
  useSigmoid: boolean;

  /**
   * Create a new neural network level.
   * @param inputCount Number of input neurons
   * @param outputCount Number of output neurons
   * @param useSigmoid Use sigmoid activation (default: false = step function)
   */
  constructor(
    inputCount: number,
    outputCount: number,
    useSigmoid: boolean = false,
  ) {
    this.inputs = new Array(inputCount).fill(0);
    this.outputs = new Array(outputCount).fill(0);
    this.biases = new Array(outputCount).fill(0);
    this.useSigmoid = useSigmoid;

    this.weights = [];
    for (let i = 0; i < inputCount; i++) {
      this.weights[i] = new Array(outputCount).fill(0);
    }

    // Level.randomize(this);
  }

  /**
   * Create a Level from a JSON object.
   */
  static fromJson(json: LevelJson): Level {
    const level = new Level(
      json.inputCount,
      json.outputCount,
      json.useSigmoid ?? false,
    );
    level.biases = [...json.biases];
    level.weights = json.weights.map((row) => [...row]);
    return level;
  }

  /**
   * Perform forward propagation through this level.
   *
   * Uses sigmoid or step activation depending on level.useSigmoid:
   * - Sigmoid: output = sigmoid(weighted_sum + bias)
   * - Step:    output = 1 if weighted_sum > bias, else 0
   *
   * @param givenInputs Input values to process
   * @param level The level to process through
   * @returns Output values after activation
   */
  static feedForward(givenInputs: number[], level: Level): number[] {
    // Copy inputs
    for (let i = 0; i < level.inputs.length; i++) {
      level.inputs[i] = givenInputs[i];
    }

    // Calculate outputs
    for (let i = 0; i < level.outputs.length; i++) {
      let sum = 0;
      let min = 1;
      for (let j = 0; j < level.inputs.length; j++) {
        const product = level.inputs[j] * level.weights[j][i];
        sum += product;
        if (product > 0 && product < min) {
          min = level.inputs[j] * level.weights[j][i];
        }
      }

      if (level.useSigmoid) {
        // Sigmoid activation: smooth output in (0, 1)
        level.outputs[i] = level.inputs.length > 0 ? min : 0;
        console.log(level.outputs);
      } else {
        // Step activation: 1 if sum > bias, else 0
        level.outputs[i] = sum > level.biases[i] ? 1 : 0;
      }
    }

    return level.outputs;
  }

  /**
   * Sigmoid activation function.
   * Maps any real number to (0, 1).
   */
  private static sigmoid(x: number): number {
    return 1 / (1 + Math.exp(-x));
  }

  /**
   * Initialize weights and biases with random values in [-1, 1].
   */
  private static randomize(level: Level): void {
    for (let i = 0; i < level.inputs.length; i++) {
      for (let j = 0; j < level.outputs.length; j++) {
        level.weights[i][j] = getRandomNumberBetween(-1, 1);
      }
    }

    for (let i = 0; i < level.biases.length; i++) {
      level.biases[i] = getRandomNumberBetween(-1, 1);
    }
  }

  /**
   * Get the current state of this level for visualization.
   */
  getState(): LevelStateJson {
    return {
      inputs: [...this.inputs],
      outputs: [...this.outputs],
      biases: [...this.biases],
      weights: this.weights.map((row) => [...row]),
    };
  }

  /**
   * Serialize the level to a JSON object.
   */
  toJson(): LevelJson {
    return {
      inputCount: this.inputs.length,
      outputCount: this.outputs.length,
      biases: [...this.biases],
      weights: this.weights.map((row) => [...row]),
      useSigmoid: this.useSigmoid,
    };
  }
}
