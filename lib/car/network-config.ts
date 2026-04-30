export interface NeuronLabel {
  name: string;
  description: string;
}

export interface NeuronLabel {
  name: string;
  description: string;
}

export const NetworkConfig = {
  markings: [
    {
      name: "Traffic Light",
      description: "Detects state of nearest traffic light in path",
    },
    {
      name: "Stop Sign",
      description: "Detects a stop sign ahead",
    },
  ],
  telemetry: [
    { name: "Speed", description: "Current forward velocity of the vehicle" },
  ],
  outputs: [
    { name: "Accelerate", description: "Apply forward throttle" },
    { name: "Steer Left", description: "Turn wheels to the left" },
    { name: "Steer Right", description: "Turn wheels to the right" },
    { name: "Decelerate", description: "Apply brakes or reverse" },
  ],
  hiddenLayers: [
    [
      { name: "H1.1", description: "Hidden Node 1.1" },
      { name: "H1.2", description: "Hidden Node 1.2" },
      { name: "H1.3", description: "Hidden Node 1.3" },
      { name: "H1.4", description: "Hidden Node 1.4" },
      { name: "H1.5", description: "Hidden Node 1.5" },
      { name: "H1.6", description: "Hidden Node 1.6" },
      { name: "H1.7", description: "Hidden Node 1.7" },
      { name: "H1.8", description: "Hidden Node 1.8" },
    ],
    [
      { name: "H2.1", description: "Hidden Node 2.1" },
      { name: "H2.2", description: "Hidden Node 2.2" },
      { name: "H2.3", description: "Hidden Node 2.3" },
      { name: "H2.4", description: "Hidden Node 2.4" },
      { name: "H2.5", description: "Hidden Node 2.5" },
      { name: "H2.6", description: "Hidden Node 2.6" },
      { name: "H2.7", description: "Hidden Node 2.7" },
    ],
    [
      { name: "H3.1", description: "Hidden Node 3.1" },
      { name: "H3.2", description: "Hidden Node 3.2" },
      { name: "H3.3", description: "Hidden Node 3.3" },
      { name: "H3.4", description: "Hidden Node 3.4" },
      { name: "H3.5", description: "Hidden Node 3.5" },
      { name: "H3.6", description: "Hidden Node 3.6" },
    ],
  ],
};

/**
 * Dynamically generates the input labels based on the sensor's ray count and the shared schema.
 */
export function getNetworkInputLabels(rayCount: number): NeuronLabel[] {
  const labels: NeuronLabel[] = [];
  for (let i = 0; i < rayCount; i++) {
    labels.push({
      name: `Physical Ray ${i + 1}`,
      description: "Detects solid obstacles like road borders and cars",
    });
  }
  for (let i = 0; i < rayCount; i++) {
    labels.push({
      name: `Virtual Ray ${i + 1}`,
      description: "Detects soft obstacles and non-colliding entities",
    });
  }
  labels.push(...NetworkConfig.markings);
  labels.push(...NetworkConfig.telemetry);
  return labels;
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
