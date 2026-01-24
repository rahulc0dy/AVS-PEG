# AVS-PEG Junie Guidelines

Autonomous Vehicle Simulation - Pathfinding Environment Generator built with Next.js 16, React 19, Three.js, and TypeScript.

## Architecture & Core Layers

- **`lib/`**: Pure simulation logic (No React). Classes manage their own Three.js meshes and disposal.
  - `world/World`: Central orchestrator; owns `Graph`, roads, cars, markings, and systems.
  - `primitives/`: `Node`, `Edge`, `Graph`, `Polygon`, `Envelope` - foundational geometry.
  - `systems/`: `TrafficLightSystem`, `PathFindingSystem`, `SpawnerSystem` - update each frame.
  - `editors/`: Extend `BaseEditor` for graph/marking manipulation.
  - `markings/`: `Marking` base class for traffic lights, sources, destinations.
  - `car/`: `Car` with physics, sensors, and `Controls` (AI/Human/None).
- **`components/hooks/`**: React hooks bridging simulation and UI.
  - `useWorld`: Manages `World` instance lifecycle.
  - `useWorldAnimation`: Drives the `requestAnimationFrame` loop, calling `world.update()` and managing structural change detection via `graph.getChanges()`.
- **`components/canvases/`**: Canvas components using render prop pattern (`SceneCanvas` provides `ThreeSceneContext`).
- **`services/`**: External integrations like `osm-service.ts` for OpenStreetMap data.

## Coordinate System

The simulation uses a 2D `Node(x, y)` system. **`y` maps to the Three.js Z-axis** when rendering.

- Position a mesh at `(node.x, 0, node.y)`.
- Vertical height in Three.js is the `Y` axis (e.g., cars at `y=0`, sensors at `y=2`).
- Use `utils/math.ts` for 2D geometry calculations before mapping to 3D.

## Key Patterns & Conventions

### Change Detection

`Graph` and other classes expose `getChanges()` counters. Systems (and `useWorldAnimation`) cache `lastObservedGraphChanges` and rebuild state (e.g., `world.generate()`) only when the counter changes to avoid expensive re-computations.

### Resource Management

All classes with Three.js resources MUST implement `dispose()` to clean up geometries and materials.

- Example: `Node.dispose()`, `Car.dispose()`, `World.dispose()`.
- Always call `dispose()` before dereferencing objects to prevent memory leaks.

### Editor Implementation

Editors must extend `BaseEditor` and implement pointer/click handlers. The `draw()` method should return `true` if it modified its `editorGroup` and needs a scene redraw.

### Serialization

`World.toJson()` / `World.load(json)` handle save/load via `WorldJson` interface in `types/save.ts`.

## Developer Workflow

- **Installation**: `bun install` (Bun 1.3+ required).
- **Development**: `bun run dev` (Runs at `localhost:3000`).
- **Build & Lint**: `bun run build`, `bun run lint`.
- **Environment**: Configurable constants are in `env.ts` using `@t3-oss/env-nextjs`. Use `NEXT_PUBLIC_` for client access.

## Coding Style & Instructions

- **JSDoc**: Always update or generate JSDoc when creating or modifying code. Document parameters, return types, and class responsibilities.
- **Comments**:
  - Do NOT write meta-comments like "New feature", "Changes here", or "Existing things remain the same".
  - Use comments to explain the "why" of complex logic, not to track changes.
- **Naming**:
  - PascalCase for React components (`.tsx`) and Simulation classes (`.ts` in `lib/`).
  - `use-*.ts` for hooks in `components/hooks/`.
- **Path Aliases**: Use `@/` to reference the project root.

## Adding Features

- **New Marking**: Add type to `MarkingType` in `types/marking.ts`, extend `Marking` in `lib/markings/`, and place GLTF in `public/models/{type}.gltf`.
- **New Editor**: Add mode to `EditorMode` in `types/editor.ts`, extend `BaseEditor` in `lib/editors/`, and wire in `useWorldEditors`.
- **New System**: Create in `lib/systems/`, instantiate in `World` constructor, and call `update()` in `World.update()`.
