import { getRandomNumberBetween } from "@/utils/math";

/**
 * JSON representation of a Level for serialization.
 */
export interface LevelJson {
  inputCount: number;
  outputCount: number;
  biases: number[];
  weights: number[][];
}

/**
 * A single layer in a neural network.
 *
 * Each level connects inputs to outputs through weighted connections.
 * Uses a simple threshold activation function (step function).
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

  /**
   * Create a new neural network level.
   * @param inputCount Number of input neurons
   * @param outputCount Number of output neurons
   */
  constructor(inputCount: number, outputCount: number) {
    this.inputs = new Array(inputCount).fill(0);
    this.outputs = new Array(outputCount).fill(0);
    this.biases = new Array(outputCount).fill(0);

    this.weights = [];
    for (let i = 0; i < inputCount; i++) {
      this.weights[i] = new Array(outputCount).fill(0);
    }

    Level.randomize(this);
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
    };
  }

  /**
   * Create a Level from a JSON object.
   */
  static fromJson(json: LevelJson): Level {
    const level = new Level(json.inputCount, json.outputCount);
    level.biases = [...json.biases];
    level.weights = json.weights.map((row) => [...row]);
    return level;
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
   * Perform forward propagation through this level.
   *
   * Uses a step activation function: output = 1 if weighted sum > bias, else 0.
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

    // Calculate outputs with step activation
    for (let i = 0; i < level.outputs.length; i++) {
      let sum = 0;
      for (let j = 0; j < level.inputs.length; j++) {
        sum += level.inputs[j] * level.weights[j][i];
      }

      // Step activation: 1 if sum > bias, else 0
      level.outputs[i] = sum > level.biases[i] ? 1 : 0;
    }

    return level.outputs;
  }
}
