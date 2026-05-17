export interface NeuronLabel {
  name: string;
  description: string;
}

export const NetworkConfig = {
  markings: [
    {
      name: "Traffic Light",
      description:
        "State of nearest traffic light in path. 1.0 = Green, 0.5 = Yellow, 0.0 = Red",
    },
    {
      name: "Stop Sign",
      description:
        "Detects a stop sign ahead. 1.0 = clear, 0.0 = stop sign present",
    },
  ],
  telemetry: [
    {
      name: "Speed",
      description:
        "Current forward velocity of the vehicle. 0.0 = stopped, 1.0 = max speed",
    },
  ],
  outputs: [
    { name: "Accelerate", description: "Apply forward throttle" },
    { name: "Steer Left", description: "Turn wheels to the left" },
    { name: "Steer Right", description: "Turn wheels to the right" },
    { name: "Decelerate", description: "Apply brakes or reverse" },
  ],
  hiddenLayers: [
    // H1: Min-logic combiners — one node per ray direction.
    // Each node combines its Physical ray (obstacle) and Virtual ray (path border)
    // via min logic. Output ≈ 0 means danger from EITHER source in that direction;
    // output ≈ 1 means direction is fully clear of both obstacles AND borders.
    [
      {
        name: "Hard-Left Clear",
        description:
          "min(PR1, VR1): Hard-left direction safety. Near 0 = blocked by obstacle or path border on hard-left. Near 1 = fully clear.",
      },
      {
        name: "Slight-Left Clear",
        description:
          "min(PR2, VR2): Slight-left direction safety. Near 0 = blocked by obstacle or path border on slight-left. Near 1 = fully clear.",
      },
      {
        name: "Centre Clear",
        description:
          "min(PR3, VR3): Forward/centre direction safety. Near 0 = obstacle or border directly ahead. Near 1 = clear road ahead.",
      },
      {
        name: "Slight-Right Clear",
        description:
          "min(PR4, VR4): Slight-right direction safety. Near 0 = blocked by obstacle or path border on slight-right. Near 1 = fully clear.",
      },
      {
        name: "Hard-Right Clear",
        description:
          "min(PR5, VR5): Hard-right direction safety. Near 0 = blocked by obstacle or path border on hard-right. Near 1 = fully clear.",
      },
      {
        name: "Left Side Blocked",
        description:
          "Aggregates hard-left and slight-left clearance (H1.1, H1.2). Fires when left side is obstructed by a car or the left lane border — triggers rightward evasion.",
      },
      {
        name: "Right Side Blocked",
        description:
          "Aggregates slight-right and hard-right clearance (H1.4, H1.5). Fires when right side is obstructed by a car or the right lane border — triggers leftward evasion.",
      },
      {
        name: "Traffic Control",
        description:
          "Combines Traffic Light and Stop Sign signals. Active when any traffic control signal requires the vehicle to slow or stop.",
      },
    ],

    // H2: Intermediate reasoning — converts H1 clearance signals into
    // directional intentions and speed decisions.
    [
      {
        name: "Evade Left",
        description:
          "Right side is blocked (H1.7 active) and left side is clear (H1.1/H1.2 clear). Indicates the vehicle should steer left to avoid an obstacle or border on the right.",
      },
      {
        name: "Evade Right",
        description:
          "Left side is blocked (H1.6 active) and right side is clear (H1.4/H1.5 clear). Indicates the vehicle should steer right to avoid an obstacle or border on the left.",
      },
      {
        name: "Front Blocked",
        description:
          "Centre ray is obstructed (H1.3 near 0). A car or border is directly ahead — triggers braking and initiates lateral escape decision.",
      },
      {
        name: "Path Clear Ahead",
        description:
          "Centre and both forward-diagonal rays are clear (H1.2, H1.3, H1.4 all near 1). Safe to maintain or increase speed.",
      },
      {
        name: "Brake — Traffic Signal",
        description:
          "Traffic control node (H1.8) indicates red light or stop sign. Overrides acceleration regardless of road clearance.",
      },
      {
        name: "Lane Drift Left",
        description:
          "Left virtual rays (VR1/VR2 component of H1.1/H1.2) are near 0 while physical rays are clear. Vehicle is drifting toward the left lane border — steer right to re-centre.",
      },
      {
        name: "Lane Drift Right",
        description:
          "Right virtual rays (VR4/VR5 component of H1.4/H1.5) are near 0 while physical rays are clear. Vehicle is drifting toward the right lane border — steer left to re-centre.",
      },
    ],

    // H3: Decision pre-processing — resolves conflicts between H2 intentions
    // and gates them before reaching the output layer.
    [
      {
        name: "Execute Accelerate",
        description:
          "Path is clear ahead (H2.4) AND no traffic signal brake (H2.5 inactive) AND speed below max. Final gate before Accelerate output.",
      },
      {
        name: "Execute Brake",
        description:
          "Front blocked (H2.3) OR traffic signal (H2.5) is active. Resolves both collision-avoidance and traffic-rule braking into a single deceleration command.",
      },
      {
        name: "Execute Steer Left",
        description:
          "Evade-Left (H2.1) OR Lane-Drift-Right (H2.7) is active, with no conflicting right-border contact. Final gate before Steer Left output.",
      },
      {
        name: "Execute Steer Right",
        description:
          "Evade-Right (H2.2) OR Lane-Drift-Left (H2.6) is active, with no conflicting left-border contact. Final gate before Steer Right output.",
      },
      {
        name: "Speed Gate",
        description:
          "Monitors current speed telemetry. Suppresses Accelerate when at max speed (Speed = 1.0) and scales braking intensity relative to current velocity.",
      },
      {
        name: "Conflict Resolver",
        description:
          "Detects simultaneous Steer Left + Steer Right signals (e.g. symmetric deadlock). Applies a tie-breaking bias — preferring rightward escape for oncoming traffic — to prevent the vehicle from freezing.",
      },
    ],
  ],
};

/**
 * Dynamically generates the input labels based on the sensor ray count.
 * Layout: [PR1..PRn] [VR1..VRn] [markings...] [telemetry...]
 * Rays are ordered Hard-Left → Slight-Left → Centre → Slight-Right → Hard-Right.
 */
export function getNetworkInputLabels(rayCount: number): NeuronLabel[] {
  const labels: NeuronLabel[] = [];

  const rayDirections = getRayDirectionNames(rayCount);

  for (let i = 0; i < rayCount; i++) {
    labels.push({
      name: `PR${i + 1} — ${rayDirections[i]}`,
      description: `Physical Ray ${i + 1} (${rayDirections[i]}): detects solid obstacles (cars, walls). 1.0 = fully clear, 0.0 = contact.`,
    });
  }

  for (let i = 0; i < rayCount; i++) {
    labels.push({
      name: `VR${i + 1} — ${rayDirections[i]}`,
      description: `Virtual Ray ${i + 1} (${rayDirections[i]}): detects path borders and lane markings. 1.0 = fully clear, 0.0 = border contact.`,
    });
  }

  labels.push(...NetworkConfig.markings);
  labels.push(...NetworkConfig.telemetry);
  return labels;
}

/**
 * Returns direction name strings for a given ray count.
 * For 5 rays: Hard-Left, Slight-Left, Centre, Slight-Right, Hard-Right.
 * Scales gracefully for other ray counts.
 */
function getRayDirectionNames(rayCount: number): string[] {
  if (rayCount === 1) return ["Centre"];
  if (rayCount === 3) return ["Left", "Centre", "Right"];
  if (rayCount === 5)
    return ["Hard-Left", "Slight-Left", "Centre", "Slight-Right", "Hard-Right"];

  // Generic fallback for arbitrary ray counts
  const names: string[] = [];
  for (let i = 0; i < rayCount; i++) {
    if (i === Math.floor(rayCount / 2)) {
      names.push("Centre");
    } else if (i < Math.floor(rayCount / 2)) {
      names.push(`Left-${Math.floor(rayCount / 2) - i}`);
    } else {
      names.push(`Right-${i - Math.floor(rayCount / 2)}`);
    }
  }
  return names;
}

/**
 * Returns the configured output labels for the neural network.
 */
export function getNetworkOutputLabels(): NeuronLabel[] {
  return [...NetworkConfig.outputs];
}

/**
 * Returns the configured hidden layer labels.
 */
export function getNetworkHiddenLabels(): NeuronLabel[][] {
  return [...NetworkConfig.hiddenLayers];
}
