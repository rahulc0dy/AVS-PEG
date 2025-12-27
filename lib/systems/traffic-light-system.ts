import { Graph } from "@/lib/primitives/graph";
import { Node } from "@/lib/primitives/node";
import { TrafficLight, LightState } from "@/lib/markings/traffic-light";
import {
  WORLD_TRAFFIC_LIGHT_GREEN_DURATION,
  WORLD_TRAFFIC_LIGHT_RED_DURATION,
  WORLD_TRAFFIC_LIGHT_YELLOW_DURATION,
} from "@/env";

/**
 * The high-level signal phase the system cycles through.
 *
 * Note: this is separate from the per-light {@link LightState} type to keep the
 * component state machine explicit.
 */
type Phase = "green" | "yellow" | "red";

/**
 * Runtime state for one connected component of the road graph.
 *
 * A "component" here is a set of connected {@link Node}s returned by
 * {@link Graph#getConnectedComponents}. Every component that contains one or
 * more {@link TrafficLight}s is simulated independently.
 */
interface ComponentState {
  /** All nodes in this connected component. */
  nodes: Node[];
  /** All traffic lights whose position matches a node in this component. */
  lights: TrafficLight[];
  /** Index of the currently-active light inside {@link ComponentState.lights}. */
  activeIndex: number;
  /** Current phase of the component state machine. */
  phase: Phase;
  /** Seconds elapsed since entering the current phase. */
  elapsed: number;
}

/**
 * Simulates traffic light cycles grouped by connected road components.
 *
 * Behavior:
 * - Rebuilds component groups whenever the underlying {@link Graph} changes.
 * - Within each component, exactly one light is "active".
 * - The active light cycles: green → yellow → red, then the next light becomes
 *   active and turns green.
 *
 * Durations are controlled via `WORLD_TRAFFIC_LIGHT_*_DURATION` values.
 */
export class TrafficLightSystem {
  private components: ComponentState[] = [];
  private lastObservedGraphChanges = -1;

  constructor(
    private trafficLightGraph: Graph,
    private getTrafficLights: () => TrafficLight[],
  ) {}

  /**
   * Advances the simulation.
   *
   * @param deltaSeconds Time since last update, in seconds.
   */
  update(deltaSeconds: number) {
    if (!this.trafficLightGraph || !this.getTrafficLights) return;

    const graphChanges = this.trafficLightGraph.getChanges();
    if (graphChanges !== this.lastObservedGraphChanges) {
      this.rebuildComponents();
      this.lastObservedGraphChanges = graphChanges;
    }

    for (const component of this.components) {
      this.advanceComponent(component, deltaSeconds);
    }
  }

  /**
   * Recomputes component groupings and resets light states.
   *
   * Called when the graph reports a change (see {@link Graph.getChanges}).
   */
  private rebuildComponents() {
    const components = this.trafficLightGraph.getConnectedComponents();
    const lights = this.getTrafficLights();

    this.components = components
      .map((nodes) => {
        const componentLights = this.findLightsForNodes(nodes, lights);
        if (componentLights.length === 0) return null;

        const initialState: ComponentState = {
          nodes,
          lights: componentLights,
          activeIndex: 0,
          phase: "green",
          elapsed: 0,
        };

        this.setComponentLights(initialState, "green");

        return initialState;
      })
      .filter((state): state is ComponentState => Boolean(state));
  }

  /**
   * Returns all traffic lights that are placed on nodes belonging to `nodes`.
   */
  private findLightsForNodes(nodes: Node[], lights: TrafficLight[]) {
    return lights.filter((light) =>
      nodes.some((node) => node.equals(light.position)),
    );
  }

  /** Sets all provided lights to red. */
  private resetLights(lights: TrafficLight[]) {
    for (const light of lights) {
      light.setState("red");
    }
  }

  /**
   * Sets the entire component to a consistent state:
   * - all lights red
   * - active light set to `activeState`
   */
  private setComponentLights(
    component: ComponentState,
    activeState: LightState,
  ) {
    this.resetLights(component.lights);
    this.setActiveLightState(component, activeState);
  }

  /** Returns the phase duration in seconds. */
  private getPhaseDurationSeconds(phase: Phase) {
    switch (phase) {
      case "green":
        return WORLD_TRAFFIC_LIGHT_GREEN_DURATION;
      case "yellow":
        return WORLD_TRAFFIC_LIGHT_YELLOW_DURATION;
      case "red":
        return WORLD_TRAFFIC_LIGHT_RED_DURATION;
    }
  }

  /**
   * Advances a single component's state machine.
   *
   * Uses a "phase timer" approach: `elapsed` accumulates until it reaches the
   * configured duration for the current phase, then transitions.
   */
  private advanceComponent(component: ComponentState, deltaSeconds: number) {
    if (component.lights.length === 0) return;

    component.elapsed += deltaSeconds;

    const phaseDuration = this.getPhaseDurationSeconds(component.phase);
    if (component.elapsed < phaseDuration) return;

    component.elapsed = 0;

    switch (component.phase) {
      case "green":
        component.phase = "yellow";
        this.setComponentLights(component, "yellow");
        break;
      case "yellow":
        component.phase = "red";
        this.setComponentLights(component, "red");
        break;
      case "red":
        component.activeIndex =
          (component.activeIndex + 1) % component.lights.length;
        component.phase = "green";
        this.setComponentLights(component, "green");
        break;
    }
  }

  /**
   * Sets the state of the currently-active light.
   *
   * Does not modify other lights. Use {@link setComponentLights} if you want a
   * stronger invariant (all red except active).
   */
  private setActiveLightState(component: ComponentState, state: LightState) {
    const light = component.lights[component.activeIndex];
    light?.setState(state);
  }
}
