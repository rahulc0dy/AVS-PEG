import { Graph } from "@/lib/primitives/graph";
import { Node } from "@/lib/primitives/node";
import { TrafficLight, LightState } from "@/lib/markings/traffic-light";

const GREEN_DURATION = 2; // seconds
const YELLOW_DURATION = 1; // seconds
const RED_DURATION = 2; // seconds

type Phase = "green" | "yellow" | "red";

interface ComponentState {
  nodes: Node[];
  lights: TrafficLight[];
  activeIndex: number;
  phase: Phase;
  elapsed: number;
}

export class TrafficLightSystem {
  private components: ComponentState[] = [];
  private lastGraphChanges = -1;

  constructor(
    private graph: Graph,
    private getTrafficLights: () => TrafficLight[],
  ) {}

  update(deltaSeconds: number) {
    if (!this.graph || !this.getTrafficLights) return;

    const graphChanges = this.graph.getChanges();
    if (graphChanges !== this.lastGraphChanges) {
      this.rebuildComponents();
      this.lastGraphChanges = graphChanges;
    }

    for (const component of this.components) {
      this.advanceComponent(component, deltaSeconds);
    }
  }

  private rebuildComponents() {
    const components = this.graph.getConnectedComponents();
    const lights = this.getTrafficLights();

    this.components = components
      .map((nodes) => {
        const componentLights = this.findLightsForNodes(nodes, lights);
        if (componentLights.length === 0) return null;

        this.resetLights(componentLights);
        componentLights[0].setState("green");

        return {
          nodes,
          lights: componentLights,
          activeIndex: 0,
          phase: "green" as Phase,
          elapsed: 0,
        };
      })
      .filter((state): state is ComponentState => Boolean(state));
  }

  private findLightsForNodes(nodes: Node[], lights: TrafficLight[]) {
    return lights.filter((light) =>
      nodes.some((node) => node.equals(light.position)),
    );
  }

  private resetLights(lights: TrafficLight[]) {
    for (const light of lights) {
      light.setState("red");
    }
  }

  private advanceComponent(component: ComponentState, deltaSeconds: number) {
    if (component.lights.length === 0) return;

    component.elapsed += deltaSeconds;

    switch (component.phase) {
      case "green":
        if (component.elapsed >= GREEN_DURATION) {
          component.phase = "yellow";
          component.elapsed = 0;
          this.setActiveLightState(component, "yellow");
        }
        break;
      case "yellow":
        if (component.elapsed >= YELLOW_DURATION) {
          component.phase = "red";
          component.elapsed = 0;
          this.setActiveLightState(component, "red");
        }
        break;
      case "red":
        if (component.elapsed >= RED_DURATION) {
          component.activeIndex =
            (component.activeIndex + 1) % component.lights.length;
          component.phase = "green";
          component.elapsed = 0;
          this.setActiveLightState(component, "green");
        }
        break;
    }
  }

  private setActiveLightState(component: ComponentState, state: LightState) {
    const light = component.lights[component.activeIndex];
    light?.setState(state);
  }
}
