import { Group } from "three";
import { Node } from "../primitives/node";
import { Marking } from "./marking";

/**
 * Stop sign road marking.
 *
 * Extends `Marking` and loads a stop sign GLTF model.
 * Unlike traffic lights, it does not contain any dynamic
 * light state or additional behavior.
 */
export class StopSign extends Marking {
  /**
   * Creates a stop sign marking at the given position and direction.
   *
   * @param position - World position of the stop sign.
   * @param direction - Orientation node determining the rotation.
   * @param group - Three.js group to attach the stop sign model to.
   */
  constructor(position: Node, direction: Node, group: Group) {
    super(position, direction, group, "stop-sign");
  }
}
