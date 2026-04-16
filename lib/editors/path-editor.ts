import { BaseEditor } from "@/lib/editors/base-editor";
import { Color, Scene, Vector3 } from "three";
import { Path } from "@/lib/markings/path";
import { Node } from "../primitives/node";
import { getNearestNode } from "@/utils/math";
import { createTextSprite } from "@/utils/rendering";

export class PathEditor extends BaseEditor {
  targetNodes: Node[];
  paths: Path[];
  selectedPathIdx: number;

  onUpdate?: () => void;

  private hoveredNode: Node | null = null;
  private needsRedraw: boolean = true;
  private lastSelectedIdx: number = -1;
  private lastPathsLength: number = -1;

  constructor(
    scene: Scene,
    targetNodes: Node[],
    paths: Path[],
    onUpdate?: () => void,
  ) {
    super(scene);

    this.targetNodes = targetNodes;
    this.paths = paths;
    this.selectedPathIdx = this.paths.length > 0 ? 0 : -1;
    this.onUpdate = onUpdate;
  }

  override draw(): boolean {
    // Check if external state changes require a redraw
    if (
      this.lastSelectedIdx !== this.selectedPathIdx ||
      this.lastPathsLength !== this.paths.length
    ) {
      this.needsRedraw = true;
      this.lastSelectedIdx = this.selectedPathIdx;
      this.lastPathsLength = this.paths.length;
    }

    if (!this.needsRedraw) return false;

    this.editorGroup.clear();

    const currentPath =
      this.selectedPathIdx >= 0 && this.selectedPathIdx < this.paths.length
        ? this.paths[this.selectedPathIdx]
        : null;

    this.targetNodes.forEach((node) => {
      let color = new Color(0xffffff); // Default node color
      let size = 1;

      // Color waypoint if it belongs to the currently selected path
      if (currentPath) {
        const waypointIndex = currentPath.waypoints.indexOf(node);
        if (waypointIndex !== -1) {
          color = new Color(currentPath.color);
          size = 1.3;
        }
      }

      // Indicate hover state
      if (node === this.hoveredNode) {
        size = 1.6;
        if (!currentPath || !currentPath.waypoints.includes(node)) {
          color = new Color(0xfff23b); // Hover color (yellow) if not a waypoint
        }
      }

      node.draw(this.editorGroup, { color, size });

      // Draw text label for waypoint index
      if (currentPath) {
        const waypointIndex = currentPath.waypoints.indexOf(node);
        if (waypointIndex !== -1) {
          const textSprite = createTextSprite(
            (waypointIndex + 1).toString(),
            color.getStyle(),
          );
          // Position relative to the node
          textSprite.position.set(node.x, 2, node.y);
          this.editorGroup.add(textSprite);
        }
      }
    });

    // Draw the borders of the currently selected path
    if (currentPath && currentPath.borders) {
      for (const edge of currentPath.borders) {
        edge.draw(this.editorGroup, {
          width: 8,
          color: new Color(currentPath.color),
        });
      }
    }

    this.scene.add(this.editorGroup);
    this.needsRedraw = false;
    return true;
  }

  override handleClickRelease(_pointer: Vector3): void {}

  override handleLeftClick(_pointer: Vector3): void {
    if (!this.hoveredNode) return;

    if (this.selectedPathIdx >= 0 && this.selectedPathIdx < this.paths.length) {
      const currentPath = this.paths[this.selectedPathIdx];

      // Avoid consecutive duplicates
      const lastNode = currentPath.waypoints.at(-1);
      if (lastNode !== this.hoveredNode) {
        currentPath.waypoints.push(this.hoveredNode);
        this.needsRedraw = true;
        this.onUpdate?.();
      }
    }
  }

  override handlePointerMove(pointer: Vector3): void {
    const nearest = getNearestNode(
      new Node(pointer.x, pointer.z),
      this.targetNodes,
      10,
    );

    if (this.hoveredNode !== nearest) {
      this.hoveredNode = nearest;
      this.needsRedraw = true;
    }
  }

  override handleRightClick(_pointer: Vector3): void {
    if (this.selectedPathIdx >= 0 && this.selectedPathIdx < this.paths.length) {
      const currentPath = this.paths[this.selectedPathIdx];

      if (this.hoveredNode) {
        // Remove all instances of the hovered node from the current path
        const originalLength = currentPath.waypoints.length;
        currentPath.waypoints = currentPath.waypoints.filter(
          (n) => n !== this.hoveredNode,
        );

        if (currentPath.waypoints.length !== originalLength) {
          this.needsRedraw = true;
          this.onUpdate?.();
        }
      }
    }
  }

  override disable(): void {
    super.disable();
    this.hoveredNode = null;
    this.needsRedraw = true;
  }
}
