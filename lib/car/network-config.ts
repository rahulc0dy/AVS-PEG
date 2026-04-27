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
    { name: "Decelerate", description: "Apply brakes or reverse" },
    { name: "Steer Left", description: "Turn wheels to the left" },
    { name: "Steer Right", description: "Turn wheels to the right" },
  ],
  hiddenLayers: [
    [
      {
        name: "Hidden Neuron 1",
        description: "Intermediate processing node",
      },
      {
        name: "Hidden Neuron 2",
        description: "Intermediate processing node",
      },
      {
        name: "Hidden Neuron 3",
        description: "Intermediate processing node",
      },
      {
        name: "Hidden Neuron 4",
        description: "Intermediate processing node",
      },
      {
        name: "Hidden Neuron 5",
        description: "Intermediate processing node",
      },
      {
        name: "Hidden Neuron 6",
        description: "Intermediate processing node",
      },
      {
        name: "Hidden Neuron 7",
        description: "Intermediate processing node",
      },
      {
        name: "Hidden Neuron 8",
        description: "Intermediate processing node",
      },
      {
        name: "Hidden Neuron 9",
        description: "Intermediate processing node",
      },
      {
        name: "Hidden Neuron 10",
        description: "Intermediate processing node",
      },
      {
        name: "Hidden Neuron 11",
        description: "Intermediate processing node",
      },
      {
        name: "Hidden Neuron 12",
        description: "Intermediate processing node",
      },
      {
        name: "Hidden Neuron 13",
        description: "Intermediate processing node",
      },
      {
        name: "Hidden Neuron 14",
        description: "Intermediate processing node",
      },
      {
        name: "Hidden Neuron 15",
        description: "Intermediate processing node",
      },
      {
        name: "Hidden Neuron 16",
        description: "Intermediate processing node",
      },
      {
        name: "Hidden Neuron 17",
        description: "Intermediate processing node",
      },
      {
        name: "Hidden Neuron 18",
        description: "Intermediate processing node",
      },
      {
        name: "Hidden Neuron 19",
        description: "Intermediate processing node",
      },
    ],
    [
      {
        name: "Hidden Neuron 1",
        description: "Intermediate processing node",
      },
      {
        name: "Hidden Neuron 2",
        description: "Intermediate processing node",
      },
      {
        name: "Hidden Neuron 3",
        description: "Intermediate processing node",
      },
      {
        name: "Hidden Neuron 4",
        description: "Intermediate processing node",
      },
      {
        name: "Hidden Neuron 5",
        description: "Intermediate processing node",
      },
      {
        name: "Hidden Neuron 6",
        description: "Intermediate processing node",
      },
      {
        name: "Hidden Neuron 7",
        description: "Intermediate processing node",
      },
      {
        name: "Hidden Neuron 8",
        description: "Intermediate processing node",
      },
      {
        name: "Hidden Neuron 9",
        description: "Intermediate processing node",
      },
      {
        name: "Hidden Neuron 10",
        description: "Intermediate processing node",
      },
      {
        name: "Hidden Neuron 11",
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
