/**
 * Types of markings supported by the system.
 *
 * - `traffic-light`: a marking representing a traffic light or its
 *   associated controller/placement in the world.
 * - `default`: a generic or unspecified marking type.
 */
export type MarkingType =
  | "traffic-light"
  | "source"
  | "destination"
  | "default";
