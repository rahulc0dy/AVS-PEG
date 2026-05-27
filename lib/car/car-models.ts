/**
 * Car model configuration and registry.
 *
 * Defines the physical and performance characteristics for each distinct
 * vehicle type in the simulation. The registry is a mutable array that
 * can be extended either by editing this file or at runtime via
 * {@link registerCarModel}. The UI and spawner automatically discover
 * all registered models — no other file changes are needed.
 *
 * @example Adding a new model
 * ```ts
 * // Option 1: Add directly to the CAR_MODELS array below.
 * // Option 2: Call registerCarModel() from any module at startup.
 * import { registerCarModel } from "@/lib/car/car-models";
 *
 * registerCarModel({
 *   id: "firetruck",
 *   displayName: "Fire Truck",
 *   breadth: 13,
 *   length: 26,
 *   height: 11,
 *   acceleration: 0.003,
 *   maxSpeed: 0.35,
 *   friction: 0.0012,
 *   modelUrl: "/models/vehicles/firetruck.gltf",
 *   modelScale: 3.5,
 * });
 * ```
 */

/**
 * Physical and performance properties that define a car model.
 *
 * Every spawned {@link Car} receives its dimensions and driving parameters
 * from one of these configs.
 */
export interface CarModelConfig {
  /** Unique identifier used in serialization and lookup. */
  id: string;
  /** Human-readable name shown in editor dropdowns. */
  displayName: string;
  /** Vehicle width along the X axis (world units). */
  breadth: number;
  /** Vehicle length along the Z axis (world units). */
  length: number;
  /** Vehicle height along the Y axis (world units). */
  height: number;
  /** Per-frame acceleration rate. */
  acceleration: number;
  /** Maximum forward speed. */
  maxSpeed: number;
  /** Friction rate applied each frame to reduce speed. */
  friction: number;
  /** URL to the GLTF model file used for rendering. */
  modelUrl: string;
  /** Uniform scale factor applied to the GLTF model when rendering. */
  modelScale: number;
}

/**
 * Mutable catalog of car models.
 *
 * Each model provides a unique combination of size and performance
 * characteristics, paired with its own GLTF visual asset located in
 * `public/models/vehicles/`.
 *
 * To add a new model, either append an entry here or call
 * {@link registerCarModel} at runtime.
 */
export const CAR_MODELS: CarModelConfig[] = [
  {
    id: "car",
    displayName: "Car",
    breadth: 10,
    length: 17.5,
    height: 7,
    acceleration: 0.005,
    maxSpeed: 0.5,
    friction: 0.002,
    modelUrl: "/models/vehicles/car.gltf",
    modelScale: 3,
  },
  {
    id: "taxi",
    displayName: "Taxi",
    breadth: 10,
    length: 17.5,
    height: 7,
    acceleration: 0.005,
    maxSpeed: 0.5,
    friction: 0.002,
    modelUrl: "/models/vehicles/taxi.gltf",
    modelScale: 3,
  },
  {
    id: "police_car",
    displayName: "Police Car",
    breadth: 10,
    length: 18,
    height: 7.5,
    acceleration: 0.007,
    maxSpeed: 0.65,
    friction: 0.0028,
    modelUrl: "/models/vehicles/police-car.gltf",
    modelScale: 3,
  },
  {
    id: "pickup_truck",
    displayName: "Pickup Truck",
    breadth: 11,
    length: 20,
    height: 8,
    acceleration: 0.004,
    maxSpeed: 0.42,
    friction: 0.0016,
    modelUrl: "/models/vehicles/pickup-truck.gltf",
    modelScale: 3,
  },
  {
    id: "ambulance",
    displayName: "Ambulance",
    breadth: 11,
    length: 22,
    height: 10,
    acceleration: 0.005,
    maxSpeed: 0.55,
    friction: 0.002,
    modelUrl: "/models/vehicles/ambulance.gltf",
    modelScale: 3,
  },
  {
    id: "bus",
    displayName: "Bus",
    breadth: 12,
    length: 30,
    height: 12,
    acceleration: 0.003,
    maxSpeed: 0.3,
    friction: 0.0012,
    modelUrl: "/models/vehicles/bus.gltf",
    modelScale: 3.5,
  },
  {
    id: "truck",
    displayName: "Truck",
    breadth: 12,
    length: 28,
    height: 11,
    acceleration: 0.0025,
    maxSpeed: 0.28,
    friction: 0.001,
    modelUrl: "/models/vehicles/truck.gltf",
    modelScale: 3.5,
  },
];

/** Default model ID used when no explicit selection is provided. */
export const DEFAULT_CAR_MODEL_ID: string = "car";

/**
 * Look up a car model by its unique identifier.
 *
 * Falls back to the default model when the given `id` does not
 * match any entry in {@link CAR_MODELS}.
 *
 * @param id - Model identifier to look up.
 * @returns The matching {@link CarModelConfig}, or the default model.
 */
export function getCarModel(id: string): CarModelConfig {
  return (
    CAR_MODELS.find((m) => m.id === id) ??
    CAR_MODELS.find((m) => m.id === DEFAULT_CAR_MODEL_ID)!
  );
}

/**
 * Register a new car model at runtime.
 *
 * The model is appended to {@link CAR_MODELS} and immediately available
 * in editor dropdowns, spawner lookups, and serialization. If a model
 * with the same `id` already exists, it is replaced in-place.
 *
 * @param config - The car model configuration to register.
 */
export function registerCarModel(config: CarModelConfig): void {
  const existingIdx = CAR_MODELS.findIndex((m) => m.id === config.id);
  if (existingIdx >= 0) {
    CAR_MODELS[existingIdx] = config;
  } else {
    CAR_MODELS.push(config);
  }
}
