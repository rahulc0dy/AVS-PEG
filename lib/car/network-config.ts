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
      {
        name: "Hidden Neuron 1-1",
        description: "Intermediate processing node",
      },
      {
        name: "Hidden Neuron 1-2",
        description: "Intermediate processing node",
      },
      {
        name: "Hidden Neuron 1-3",
        description: "Intermediate processing node",
      },
      {
        name: "Hidden Neuron 1-4",
        description: "Intermediate processing node",
      },
      {
        name: "Hidden Neuron 1-5",
        description: "Intermediate processing node",
      },
      {
        name: "Hidden Neuron 1-6",
        description: "Intermediate processing node",
      },
      {
        name: "Hidden Neuron 1-7",
        description: "Intermediate processing node",
      },
      {
        name: "Hidden Neuron 1-8",
        description: "Intermediate processing node",
      },
    ],
    [
      {
        name: "Hidden Neuron 2-1",
        description: "Intermediate processing node",
      },
      {
        name: "Hidden Neuron 2-2",
        description: "Intermediate processing node",
      },
      {
        name: "Hidden Neuron 2-3",
        description: "Intermediate processing node",
      },
      {
        name: "Hidden Neuron 2-4",
        description: "Intermediate processing node",
      },
      {
        name: "Hidden Neuron 2-5",
        description: "Intermediate processing node",
      },
      {
        name: "Hidden Neuron 2-6",
        description: "Intermediate processing node",
      },
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
