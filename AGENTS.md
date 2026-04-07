# AVS-PEG Agent Instructions

Autonomous Vehicle Simulation - Pathfinding Environment Generator built with Next.js 16, React 19, Three.js, and TypeScript.

## Project Structure

```
AVS-PEG/
├── app/                      # Next.js App Router pages
│   ├── layout.tsx            # Root layout with metadata
│   ├── page.tsx              # Landing page (/)
│   ├── manifest.ts           # PWA manifest
│   ├── edit/                 # Graph/marking editor (/edit)
│   ├── simulate/             # Manual driving mode (/simulate)
│   └── train/                # AI training mode (/train)
├── components/
│   ├── canvases/             # Page-level canvas components (render prop pattern)
│   ├── hooks/                # React hooks bridging simulation and UI
│   ├── ui/                   # Reusable UI primitives (Button, Modal, etc.)
│   └── world-ui/             # World interaction UI (toolbars, overlays)
├── lib/                      # Pure simulation logic (no React)
│   ├── ai/                   # NeuralNetwork, Level
│   ├── car/                  # Car, Sensor, Controls, car.worker.ts
│   ├── editors/              # BaseEditor, GraphEditor, MarkingEditor subclasses
│   ├── markings/             # Marking base class and subtypes
│   ├── primitives/           # Node, Edge, Graph, Polygon, Envelope
│   ├── systems/              # TrafficLightSystem, PathFindingSystem, etc.
│   └── world/                # World, Road
├── public/
│   ├── icons/                # App icons
│   ├── models/               # GLTF models (car, traffic-light, source, destination, stop-sign)
│   └── site-icons/           # Site favicon assets
├── services/                 # External API integrations
│   └── osm-service.ts        # Overpass API for OSM data
├── styles/
│   └── globals.css           # Global styles and Tailwind imports
├── types/                    # Shared TypeScript definitions
│   ├── car/                  # Worker thread communication types
│   │   ├── message.ts        # Message payloads and type constants
│   │   ├── shared.ts         # Types shared between main/worker threads
│   │   └── state.ts          # Worker state and network visualization types
│   ├── editor.ts             # EditorMode, Editor interface
│   ├── intersection.ts       # Intersection geometry types
│   ├── marking.ts            # MarkingType, GraphEdgeType
│   ├── osm.ts                # OpenStreetMap data types
│   └── save.ts               # Serialization interfaces (WorldJson, etc.)
├── utils/                    # Pure utility functions
│   ├── browser.ts            # Browser detection
│   ├── infinite-grid-helper.ts # Three.js infinite grid
│   ├── math.ts               # Mathematical helpers
│   ├── osm.ts                # OSM parsing and coordinate conversion
│   ├── rendering.ts          # Three.js rendering utilities
│   └── road-surface-texture.ts # Procedural road textures
├── env.ts                    # Environment variables (t3-oss/env-nextjs)
├── AGENTS.md                 # This file - agent instructions
├── INFERENCE_RULES.md        # Neural network architecture for obstacle avoidance
└── README.md                 # Project documentation
```

## Architecture Overview

### Core Layers

- **`lib/`** - Pure simulation logic (no React). Classes manage their own Three.js meshes and disposal.
  - `world/World` - Central orchestrator: owns `Graph`, roads, cars, markings, and four subsystems
  - `world/Road` - Road segment extending `Envelope` with lane count, road type, and visual layers (base, lanes, arrows)
  - `primitives/` - `Node`, `Edge`, `Graph`, `Polygon`, `Envelope` - foundation for all geometry
  - `ai/` - `NeuralNetwork` (feedforward network with mutation support) and `Level` (single layer with step activation)
  - `systems/` - `TrafficLightSystem`, `PathFindingSystem`, `SpawnerSystem`, `TrainingSystem` - update each frame
  - `editors/` - `BaseEditor` abstract class → `GraphEditor` for graph manipulation; `MarkingEditor` intermediate abstract → `TrafficLightEditor`, `SourceDestinationEditor` for marking placement
  - `markings/` - `Marking` base class for traffic lights, sources, destinations
  - `car/` - `Car` with physics offloaded to Web Worker, `Sensor`, and `Controls` (`ControlType`: `HUMAN`/`AI`/`NONE`)

- **`types/car/`** - Type definitions for car worker thread communication
  - `message.ts` - Message payloads (`CarInitPayload`, `UpdateControlsPayload`, `UpdateCollisionDataPayload`, `UpdateWeightPayload`, `UpdateBiasPayload`, `SetBrainPayload`, `CarStatePayload`, `SensorUpdatePayload`), type constants (`WorkerInboundMessageType`, `WorkerOutboundMessageType`), and discriminated unions (`CarWorkerInboundMessage`, `CarWorkerOutboundMessage`)
  - `shared.ts` - Serializable types shared between main thread and worker: `CarBasePayload`, `SensorConfig`, `ControlInputs`
  - `state.ts` - `WorkerCarState` type for worker-side state, `NeuralNetworkStateJson` and `LevelStateJson` for real-time network visualization

- **`components/hooks/`** - React hooks that bridge simulation and UI
  - `useWorld` - Creates/disposes `World` instance
  - `useWorldEditors` - Wires up editor instances and mode switching
  - `useWorldInput` - Pointer/raycasting to world coordinates
  - `useWorldAnimation` - Render loop calling `world.update()` and `editor.draw()`
  - `useWorldSimulation` - Simulation loop for non-editor views (updates OrbitControls, world, and graph changes)
  - `useWorldPersistence` - JSON save/load helpers (`saveToJson`, `loadFromJson`)
  - `useMiniCamera` - Scissored inset camera that follows the first car
  - `useTrafficDetector` - COCO-SSD model for traffic light detection with color classification
  - `useThreeScene` - Creates Three.js scene, camera, and renderer

- **`components/canvases/`** - Page-level canvas components using render prop pattern
  - `SceneCanvas` - Provides `ThreeSceneContext` → children receive `{scene, camera, renderer, dom}`
  - `EditingCanvas` - Full editor UI with graph/marking editors
  - `SimulationCanvas` - Manual driving mode with human-controlled car
  - `TrainingCanvas` - AI training mode with multiple cars, mutation controls, and fitness tracking
  - `NetworkCanvas` - Interactive 2D canvas for neural network visualization; accepts `NeuralNetworkStateJson` directly, supports scroll-to-edit weights/biases. Hovering any neuron shows its activation value; hidden/output neurons also show bias. Hovering a connection shows its weight.

- **`components/world-ui/`** - UI components for world interaction
  - `FileToolbar` - Save/load/export buttons
  - `MiniMapOverlay` - Renders the mini camera viewport
  - `ModeControls` - Editor mode toggle buttons
  - `Navigation` - Page navigation links
  - `NeuralNetworkVisualizer` - Slideable panel wrapping `NetworkCanvas` for real-time network state display
  - `OsmModal` - OpenStreetMap import dialog

- **`components/ui/`** - Reusable UI primitives
  - `SlideablePanel` - Collapsible panel supporting top/bottom/left/right positions
  - `Button`, `Card`, `Checkbox`, `Input`, `Label`, `Modal`, `Toast`

- **`services/`** - External API integrations
  - `osm-service.ts` - Fetches road data from Overpass API with bbox filtering

- **`utils/`** - Pure utility functions
  - `browser.ts` - Browser detection and capabilities
  - `infinite-grid-helper.ts` - Three.js infinite grid helper class
  - `math.ts` - Mathematical helpers (lerp, clamp, angle calculations, `Intersection` type)
  - `osm.ts` - OSM data parsing and coordinate conversion
  - `rendering.ts` - Three.js rendering utilities
  - `road-surface-texture.ts` - Procedural road texture generation

- **`types/`** - Shared type definitions
  - `editor.ts` - `EditorMode` type (`"graph" | "traffic-lights" | "source-destination"`) and `Editor` interface
  - `marking.ts` - `MarkingType`, `GraphEdgeType`, `SourceDestinationMarkingType`
  - `osm.ts` - OpenStreetMap data types
  - `save.ts` - Serialization interfaces: `WorldJson`, `GraphJson`, `NodeJson`, `EdgeJson`, `RoadJson`, `EnvelopeJson`, `PolygonJson`, `MarkingJson`, `TrafficLightJson`, `LevelJson`, `NeuralNetworkJson`

### App Routes

- `/` - Main landing page
- `/edit` - Graph and marking editor
- `/simulate` - Manual driving simulation
- `/train` - AI training with multiple cars

### Coordinate System

The codebase uses a 2D `Node(x, y)` for simulation, where **`y` maps to Three.js Z-axis** when rendering. Position a mesh at `(node.x, 0, node.y)`.

### Change Detection Pattern

`Graph` and other classes expose `getChanges()` counters. Systems like `TrafficLightSystem` cache `lastObservedGraphChanges` and rebuild state only when the counter changes.

## Key Patterns

### Editor Implementation

Editors extend `BaseEditor` (or `MarkingEditor` for marking-based editors) and implement:

```typescript
abstract handlePointerMove(pointer: Vector3): void;
abstract handleLeftClick(pointer: Vector3): void;
abstract handleRightClick(pointer: Vector3): void;
abstract handleClickRelease(pointer: Vector3): void;
abstract draw(): boolean; // return true if scene needs re-render
```

**Editor hierarchy:**

- `BaseEditor` (abstract) → `GraphEditor` (graph nodes/edges)
- `BaseEditor` → `MarkingEditor` (abstract, adds intent preview + edge snapping) → `TrafficLightEditor`, `SourceDestinationEditor`

Each editor owns an `editorGroup: Group` attached to the scene. Toggle visibility via `enable()`/`disable()`.

### Resource Disposal

All classes with Three.js resources implement `dispose()` to clean up geometries/materials. Call `dispose()` before dereferencing. Example: `Node.dispose()`, `Car.dispose()`, `World.dispose()`. `Car.dispose()` also terminates the associated worker thread.

### Worker Thread Communication (Car Physics)

Vehicle physics run in a dedicated Web Worker (`car.worker.ts`) to keep the main thread responsive:

**Architecture:**

- `Car` (main thread) handles rendering, sensors, and control inputs
- `car.worker` (worker thread) runs physics simulation: acceleration, friction, steering, collision detection, and neural network forward propagation

**Message Flow:**

1. `Car.initWorker()` spawns worker and sends `INIT` message with initial car state
2. Each frame, `Car.update()` sends `UPDATE_CONTROLS` and `UPDATE_COLLISION_DATA` to worker
3. Worker runs physics at `requestAnimationFrame` rate, posts `STATE_UPDATE` back with position, angle, damage, polygon, and network state
4. Worker also posts `SENSOR_UPDATE` with sensor rays and readings
5. Main thread updates `Car` properties from worker state

**Additional inbound messages:**

- `UPDATE_WEIGHT` / `UPDATE_BIAS` - Live-edit individual network parameters from the UI
- `SET_BRAIN` - Replace the entire neural network (e.g. loading a saved brain)

**Serialization Pattern:**
Complex classes (`Node`, `Polygon`, `Edge`) are serialized to plain objects (`NodeJson`, `PolygonJson`, `EdgeJson`) from `types/save.ts` for worker transfer. Worker-specific types live in `types/car/`:

- `shared.ts` - Base types: `CarBasePayload`, `SensorConfig`, `ControlInputs`
- `message.ts` - Message payloads (`CarInitPayload`, `CarStatePayload`, `UpdateCollisionDataPayload`, `UpdateControlsPayload`, `UpdateWeightPayload`, `UpdateBiasPayload`, `SetBrainPayload`, `SensorUpdatePayload`) and type constants (`WorkerInboundMessageType`, `WorkerOutboundMessageType`)
- `state.ts` - `WorkerCarState` type for worker-side state, `NeuralNetworkStateJson` and `LevelStateJson` for real-time visualization

### Serialization

`World.toJson()` / `World.fromJson(json)` handle save/load via `WorldJson` interface in `types/save.ts`. Markings, roads, and graphs are serialized separately.

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
- **Avoid deprecated APIs**: Use modern JavaScript/TypeScript methods. For example:
  - Use `.substring()` instead of `.substr()` (deprecated)
  - Use `.at()` instead of bracket notation for negative indices when needed
- **Imports**: Use the `@/` path alias for all imports from the project root.
- **Type Safety**: Prefer strict typing over `any`. Use discriminated unions for message types.
- **Separation of Concerns**:
  - Keep React code in `components/`
  - Keep pure simulation logic in `lib/` (no React imports)
  - Keep shared types in `types/`
  - Keep utilities stateless and side-effect free in `utils/`

## Rules

### General Rules

1. **No React in `lib/`**: The `lib/` folder contains pure simulation logic. Never import React or React hooks here.
2. **Dispose Resources**: All classes with Three.js resources must implement `dispose()`. Call it before dereferencing.
3. **Worker Serialization**: Data crossing the worker boundary must be plain objects (use `*Json` types from `types/save.ts`).
4. **Coordinate System**: 2D `Node(x, y)` maps to Three.js as `(node.x, 0, node.y)`. Y is always 0 for ground-level objects.
5. **Change Detection**: Use `getChanges()` counters to detect when to rebuild derived state.

### File Naming Rules

- React components: `kebab-case.ts`
- Hooks: `use-kebab-case.ts` in `components/hooks/`
- Simulation classes: `PascalCase.ts` in `lib/`
- Type definitions: `kebab-case.ts` in `types/`
- Utilities: `kebab-case.ts` in `utils/`
- Workers: `*.worker.ts`

### Adding New Features

#### New Marking Type

1. Add type to `MarkingType` in `types/marking.ts`
2. Create class extending `Marking` in `lib/markings/`
3. Place GLTF model at `public/models/{type}.gltf` (auto-loaded by `Marking.draw()`)
4. Update `WorldJson` in `types/save.ts` if serialization needed
5. Update `World.fromJson()` to deserialize the new marking type

#### New Editor Mode

1. Add mode to `EditorMode` in `types/editor.ts`
2. Create editor class extending `BaseEditor` (or `MarkingEditor`) in `lib/editors/`
3. Wire up in `useWorldEditors` hook - create instance, handle mode switching
4. Add UI toggle in `ModeControls` component

#### New System

1. Create class in `lib/systems/` with `update(deltaSeconds)` method
2. Instantiate in `World` constructor
3. Call `system.update()` in `World.update()`
4. Implement `dispose()` if the system holds resources

#### New Worker Message Type

1. Add payload type to `types/car/message.ts`
2. Add type constant to `WorkerInboundMessageType` or `WorkerOutboundMessageType`
3. Add to discriminated union (`CarWorkerInboundMessage` or `CarWorkerOutboundMessage`)
4. Handle in worker's `onmessage` or main thread's message handler

## Commands

```bash
bun install        # Install dependencies (Bun 1.3+ required)
bun run dev        # Start dev server at localhost:3000
bun run build      # Production build
bun run lint       # Run ESLint
```

## File Conventions

- Path alias: `@/` maps to project root
- React components: PascalCase `.tsx` files
- Hooks: `use-*.ts` in `components/hooks/`
- Simulation classes: PascalCase `.ts` in `lib/`
- Types: interfaces in `types/` folder
- GLTF models: `public/models/{name}.gltf`
- Environment variables: `env.ts` using `@t3-oss/env-nextjs`
