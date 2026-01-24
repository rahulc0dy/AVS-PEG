# AVS-PEG Copilot Instructions

Autonomous Vehicle Simulation - Pathfinding Environment Generator built with Next.js 16, React 19, Three.js, and TypeScript.

## Architecture Overview

### Core Layers

- **`lib/`** - Pure simulation logic (no React). Classes manage their own Three.js meshes and disposal.
  - `world/World` - Central orchestrator: owns `Graph`, roads, cars, markings, and three subsystems
  - `primitives/` - `Node`, `Edge`, `Graph`, `Polygon`, `Envelope` - foundation for all geometry
  - `systems/` - `TrafficLightSystem`, `PathFindingSystem`, `SpawnerSystem` - update each frame
  - `editors/` - Extend `BaseEditor` abstract class for graph/marking manipulation
  - `markings/` - `Marking` base class for traffic lights, sources, destinations
  - `car/` - `Car` with physics, sensors, and `Controls` (AI/Human/None)

- **`components/hooks/`** - React hooks that bridge simulation and UI
  - `useWorld` - Creates/disposes `World` instance
  - `useWorldEditors` - Wires up editor instances and mode switching
  - `useWorldInput` - Pointer/raycasting to world coordinates
  - `useWorldAnimation` - Render loop calling `world.update()` and `editor.draw()`

- **`components/canvases/`** - Page-level canvas components using render prop pattern
  - `SceneCanvas` provides `ThreeSceneContext` → children receive `{scene, camera, renderer, dom}`

### Coordinate System

The codebase uses a 2D `Node(x, y)` for simulation, where **`y` maps to Three.js Z-axis** when rendering. Position a mesh at `(node.x, 0, node.y)`.

### Change Detection Pattern

`Graph` and other classes expose `getChanges()` counters. Systems like `TrafficLightSystem` cache `lastObservedGraphChanges` and rebuild state only when the counter changes.

## Key Patterns

### Editor Implementation

Editors extend `BaseEditor` and implement:

```typescript
abstract handlePointerMove(pointer: Vector3): void;
abstract handleLeftClick(pointer: Vector3): void;
abstract handleRightClick(pointer: Vector3): void;
abstract handleClickRelease(pointer: Vector3): void;
abstract draw(): boolean; // return true if scene needs re-render
```

Each editor owns an `editorGroup: Group` attached to the scene. Toggle visibility via `enable()`/`disable()`.

### Resource Disposal

All classes with Three.js resources implement `dispose()` to clean up geometries/materials. Call `dispose()` before dereferencing. Example: `Node.dispose()`, `Car.dispose()`, `World.dispose()`.

### Serialization

`World.toJson()` / `World.load(json)` handle save/load via `WorldJson` interface in `types/save.ts`. Markings, roads, and graphs are serialized separately.

### Environment Variables

Configurable constants are in `env.ts` using `@t3-oss/env-nextjs`. Prefix with `NEXT_PUBLIC_` for client access:

```typescript
import { ROAD_WIDTH, TRAFFIC_LIGHT_THRESHOLD } from "@/env";
```

## Coding Style & Instructions

- **JSDoc**: Always update or generate JSDoc when creating or modifying code. Document parameters, return types, and class responsibilities.
- **Comments**:
  - Do NOT write meta-comments like "New feature", "Changes here", or "Existing things remain the same".
  - Use comments to explain the "why" of complex logic, not to track changes.

## Commands

```bash
bun install        # Install dependencies (Bun 1.3+ required)
bun run dev        # Start dev server at localhost:3000
bun run build      # Production build
bun run lint       # Run ESLint
```

## Adding Features

### New Marking Type

1. Add type to `MarkingType` in `types/marking.ts`
2. Create class extending `Marking` in `lib/markings/`
3. Place GLTF model at `public/models/{type}.gltf` (auto-loaded by `Marking.draw()`)
4. Update `WorldJson` if serialization needed

### New Editor Mode

1. Add mode to `EditorMode` in `types/editor.ts`
2. Create editor class extending `BaseEditor` in `lib/editors/`
3. Wire up in `useWorldEditors` hook - create instance, handle mode switching
4. Add UI toggle in `ModeControls` component

### New System

1. Create class in `lib/systems/` with `update(deltaSeconds)` method
2. Instantiate in `World` constructor
3. Call `system.update()` in `World.update()`

## File Conventions

- Path alias: `@/` maps to project root
- React components: PascalCase `.tsx` files
- Hooks: `use-*.ts` in `components/hooks/`
- Simulation classes: PascalCase `.ts` in `lib/`
- Types: interfaces in `types/` folder
