import { applyPatch, compare, Operation } from "fast-json-patch";
import { World } from "@/lib/world/world";
import { WorldJson } from "@/types/save";

/**
 * Represents a set of operations to transition between two states.
 */
interface DiffAction {
  /** The operations required to revert the state. */
  undo: Operation[];
  /** The operations required to reapply the state. */
  redo: Operation[];
}

/**
 * Manages the undo and redo history for the World state.
 */
export class HistoryManager {
  /** Stack of actions that can be undone. */
  private undoStack: DiffAction[] = [];
  /** Stack of actions that can be redone. */
  private redoStack: DiffAction[] = [];
  /** The current state of the world as a JSON object. */
  private currentState: WorldJson | null = null;
  /** The world instance being managed. */
  private world: World;

  /**
   * Initializes a new HistoryManager for the given world.
   * @param world The world instance to track.
   */
  constructor(world: World) {
    this.world = world;
    this.currentState = world.toJson();
  }

  /**
   * Saves the current world state to the history if there are significant changes.
   */
  public saveState(): void {
    const newState = this.world.toJson();
    if (!this.currentState) {
      this.currentState = newState;
      return;
    }

    if (this.hasSignificantChanges(this.currentState, newState)) {
      const redoPatch = compare(this.currentState, newState);
      if (redoPatch.length > 0) {
        const undoPatch = compare(newState, this.currentState);
        this.undoStack.push({ undo: undoPatch, redo: redoPatch });
        this.redoStack = [];
        this.currentState = newState;
      }
    }
  }

  /**
   * Reverts the world state to the previous step in history.
   */
  public undo(): void {
    if (this.undoStack.length > 0 && this.currentState) {
      const action = this.undoStack.pop()!;
      this.redoStack.push(action);

      const nextState = applyPatch(
        structuredClone(this.currentState),
        action.undo,
        false,
        false,
      ).newDocument as WorldJson;

      this.currentState = nextState;
      this.world.fromJson(nextState);
      this.world.draw();
    }
  }

  /**
   * Reapplies the next world state in history.
   */
  public redo(): void {
    if (this.redoStack.length > 0 && this.currentState) {
      const action = this.redoStack.pop()!;
      this.undoStack.push(action);

      const nextState = applyPatch(
        structuredClone(this.currentState),
        action.redo,
        false,
        false,
      ).newDocument as WorldJson;

      this.currentState = nextState;
      this.world.fromJson(nextState);
      this.world.draw();
    }
  }

  /**
   * Determines if two states have significant differences in properties that matter.
   * @param stateA The first state to compare.
   * @param stateB The second state to compare.
   * @returns True if the states differ significantly, false otherwise.
   */
  private hasSignificantChanges(stateA: WorldJson, stateB: WorldJson): boolean {
    const clean = (state: WorldJson) => {
      const copy = structuredClone(state) as Partial<WorldJson>;
      // Ignore purely derived entities
      delete copy.roadBorders;
      delete copy.roads;

      // Ignore simulation state such as traffic light changes
      if (Array.isArray(copy.markings)) {
        copy.markings.forEach((m: any) => {
          delete m.lightState;
        });
      }
      return copy;
    };

    return JSON.stringify(clean(stateA)) !== JSON.stringify(clean(stateB));
  }
}
