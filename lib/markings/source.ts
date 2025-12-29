import { Marking } from "@/lib/markings/marking";
import { Node } from "../primitives/node";
import { Group } from "three";

export class Source extends Marking {
  constructor(position: Node, direction: Node, group: Group) {
    super(position, direction, group, "source");
  }
}
