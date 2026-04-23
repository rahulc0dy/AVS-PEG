export const NetworkConfig = {
  markings: ["Traffic Light", "Stop Sign"],
  telemetry: ["Speed"],
  outputs: ["Accelerate", "Left", "Right", "Decelerate"],
  hiddenLayers: [7, 6],
};

/**
 * Dynamically generates the input labels based on the sensor's ray count and the shared schema.
 */
export function getNetworkInputLabels(rayCount: number): string[] {
  const labels: string[] = [];
  for (let i = 0; i < rayCount; i++) {
    labels.push(`Ray ${i + 1}`);
  }
  labels.push(...NetworkConfig.markings);
  labels.push(...NetworkConfig.telemetry);
  return labels;
}

/**
 * Returns the configured output labels for the neural network.
 */
export function getNetworkOutputLabels(): string[] {
  return [...NetworkConfig.outputs];
}
