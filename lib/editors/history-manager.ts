import { applyPatch, compare, Operation } from "fast-json-patch";
import { World } from "@/lib/world/world";

interface DiffAction {
  undo: Operation[];
  redo: Operation[];
}

export class HistoryManager {
  private undoStack: DiffAction[] = [];
  private redoStack: DiffAction[] = [];
  private currentState: Record<string, unknown> | null = null;
  private world: World;

  constructor(world: World) {
    this.world = world;
    this.currentState = world.toJson();
  }

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

  public undo(): void {
    if (this.undoStack.length > 0 && this.currentState) {
      const action = this.undoStack.pop()!;
      this.redoStack.push(action);

      const nextState = applyPatch(
        structuredClone(this.currentState),
        action.undo,
        false,
        false,
      ).newDocument;

      this.currentState = nextState;
      this.world.fromJson(nextState);
      this.world.draw();
    }
  }

  public redo(): void {
    if (this.redoStack.length > 0 && this.currentState) {
      const action = this.redoStack.pop()!;
      this.undoStack.push(action);

      const nextState = applyPatch(
        structuredClone(this.currentState),
        action.redo,
        false,
        false,
      ).newDocument;

      this.currentState = nextState;
      this.world.fromJson(nextState);
      this.world.draw();
    }
  }

  private hasSignificantChanges(
    stateA: Record<string, unknown>,
    stateB: Record<string, unknown>,
  ): boolean {
    const clean = (state: Record<string, unknown>) => {
      const copy = structuredClone(state) as Record<string, unknown>;
      // Ignore purely derived entities
      delete copy.roadBorders;
      delete copy.roads;

      // Ignore simulation state such as traffic light changes
      if (Array.isArray(copy.markings)) {
        copy.markings.forEach((m: Record<string, unknown>) => {
          delete m.lightState;
        });
      }
      return copy;
    };

    return JSON.stringify(clean(stateA)) !== JSON.stringify(clean(stateB));
  }
}
