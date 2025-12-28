import { Group, Scene } from "three";
import { MarkingEditor } from "@/lib/editors/marking-editor";
import { Marking } from "@/lib/markings/marking";
import { Node } from "@/lib/primitives/node";
import { Edge } from "@/lib/primitives/edge";
import { Destination } from "../markings/destination";
import { Source } from "../markings/source";

type SourceDestinationMarkingType = "source" | "destination";

export class SourceDestinationEditor extends MarkingEditor {
  private currentMarkingType: SourceDestinationMarkingType = "source";

  setMarkingType(type: SourceDestinationMarkingType) {
    this.currentMarkingType = type;
  }

  constructor(
    scene: Scene,
    targetEdges: Edge[],
    markings: Marking[],
    commitGroup?: Group,
  ) {
    super(scene, targetEdges, markings, commitGroup);
  }

  override createMarking(position: Node, direction: Node): Marking {
    // Preview is still drawn in the editor group; on commit, base class moves it to commit group.
    switch (this.currentMarkingType) {
      case "source":
        return new Source(position, direction, this.editorGroup);
      case "destination":
        return new Destination(position, direction, this.editorGroup);
    }
  }

  override handleTabKeyPress(): void {
    // Cycle through marking types
    if (this.currentMarkingType === "source") {
      this.currentMarkingType = "destination";
    } else {
      this.currentMarkingType = "source";
    }
    this.intent?.dispose();
    this.intent = null;
  }
}
