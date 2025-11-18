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
