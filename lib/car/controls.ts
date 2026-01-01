import { NeuralNetwork } from "@/lib/ai/network";

/**
 * Available control schemes for a `Car`.
 *
 * - `HUMAN`: controlled by keyboard input.
 * - `AI`: autonomous controller (simple default behaviour applied).
 */
export enum ControlType {
  HUMAN,
  AI,
  NONE,
}

/**
 * Simple input state container for a car.
 *
 * The class stores four boolean flags reflecting the current input state
 * and, for `HUMAN` control type, attaches keyboard listeners that update
 * those flags. The implementation accepts both arrow keys and WASD in
 * either lowercase or uppercase (e.g. `w` and `W` both work).
 */
export class Controls {
  private readonly type: ControlType;

  /** True while the forward input is active (ArrowUp / W). */
  forward = false;
  /** True while the left input is active (ArrowLeft / A). */
  left = false;
  /** True while the right input is active (ArrowRight / D). */
  right = false;
  /** True while the reverse input is active (ArrowDown / S). */
  reverse = false;

  /**
   * Construct controls for a car.
   * @param type - The control type (`HUMAN` attaches keyboard listeners,
   *               `AI` enables a simple forward default).
   */
  constructor(type: ControlType) {
    this.type = type;

    this.forward = false;
    this.left = false;
    this.right = false;
    this.reverse = false;

    switch (type) {
      case ControlType.HUMAN:
        this.addKeyboardListeners();
        break;
      case ControlType.AI:
        // Simple AI behaviour: drive forward by default
        this.forward = true;
        break;
      case ControlType.NONE:
        // No input by default
        break;
    }
  }

  /** Reset all input flags to false. */
  reset() {
    this.forward = false;
    this.left = false;
    this.right = false;
    this.reverse = false;
  }

  /** Apply a network output vector `[forward,left,right,reverse]` to flags. */
  applyNetworkOutputs(outputs: number[]) {
    this.forward = outputs[0] === 1;
    this.left = outputs[1] === 1;
    this.right = outputs[2] === 1;
    this.reverse = outputs[3] === 1;
  }

  /**
   * For AI-controlled cars: compute network outputs from sensor offsets and
   * update the control flags.
   */
  applyAI(sensorOffsets: number[], brain: NeuralNetwork) {
    if (this.type !== ControlType.AI) return;
    const outputs = brain.decide(sensorOffsets);
    this.applyNetworkOutputs(outputs);
  }

  /**
   * Attach keyboard listeners to update control state.
   *
   * Key mappings:
   * - Left: `ArrowLeft`, `a`, `A`
   * - Right: `ArrowRight`, `d`, `D`
   * - Forward: `ArrowUp`, `w`, `W`
   * - Reverse: `ArrowDown`, `s`, `S`
   */
  private addKeyboardListeners() {
    document.onkeydown = (event: KeyboardEvent) => {
      switch (event.key) {
        case "ArrowLeft":
        case "a":
        case "A":
          this.left = true;
          break;
        case "ArrowRight":
        case "d":
        case "D":
          this.right = true;
          break;
        case "ArrowUp":
        case "w":
        case "W":
          this.forward = true;
          break;
        case "ArrowDown":
        case "s":
        case "S":
          this.reverse = true;
          break;
      }
    };
    document.onkeyup = (event: KeyboardEvent) => {
      switch (event.key) {
        case "ArrowLeft":
        case "a":
        case "A":
          this.left = false;
          break;
        case "ArrowRight":
        case "d":
        case "D":
          this.right = false;
          break;
        case "ArrowUp":
        case "w":
        case "W":
          this.forward = false;
          break;
        case "ArrowDown":
        case "s":
        case "S":
          this.reverse = false;
          break;
      }
    };
  }
}
