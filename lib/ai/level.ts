import { getRandomNumberBetween } from "@/utils/math";

/**
 * JSON representation of a Level for serialization.
 */
export interface LevelJson {
  inputs: number[];
  outputs: number[];
  biases: number[];
  weights: number[][];
}

export class Level {
  inputs: number[];
  outputs: number[];
  biases: number[];
  weights: number[][];

  constructor(inputCount: number, outputCount: number) {
    this.inputs = Array(inputCount);
    this.outputs = Array(outputCount);
    this.biases = Array(outputCount);

    this.weights = [];
    for (let i = 0; i < inputCount; i++) {
      this.weights[i] = Array(outputCount);
    }

    Level.randomize(this);
  }

  /**
   * Serialize the level to a JSON object.
   */
  toJson(): LevelJson {
    return {
      inputs: [...this.inputs],
      outputs: [...this.outputs],
      biases: [...this.biases],
      weights: this.weights.map((row) => [...row]),
    };
  }

  /**
   * Load the level state from a JSON object.
   */
  fromJson(json: LevelJson): void {
    this.inputs = [...json.inputs];
    this.outputs = [...json.outputs];
    this.biases = [...json.biases];
    this.weights = json.weights.map((row) => [...row]);
  }

  /**
   * Create a Level from a JSON object.
   */
  static fromJson(json: LevelJson): Level {
    const level = new Level(json.inputs.length, json.outputs.length);
    level.fromJson(json);
    return level;
  }

  private static randomize(level: Level) {
    for (let i = 0; i < level.inputs.length; i++) {
      for (let j = 0; j < level.outputs.length; j++) {
        level.weights[i][j] = getRandomNumberBetween(-1, 1);
      }
    }

    for (let i = 0; i < level.biases.length; i++) {
      level.biases[i] = getRandomNumberBetween(-1, 1);
    }
  }

  static feedForward(givenInputs: number[], level: Level) {
    for (let i = 0; i < level.inputs.length; i++) {
      level.inputs[i] = givenInputs[i];
    }

    for (let i = 0; i < level.outputs.length; i++) {
      let sum = 0;
      for (let j = 0; j < level.inputs.length; j++) {
        sum += level.inputs[j] * level.weights[j][i];
      }

      if (sum > level.biases[i]) {
        level.outputs[i] = 1;
      } else {
        level.outputs[i] = 0;
      }
    }

    return level.outputs;
  }
}
