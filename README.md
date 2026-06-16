# AVS-Autonomous Vehicle Simulator

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Build](https://github.com/rahulc0dy/AVS-PEG/actions/workflows/build.yaml/badge.svg)](https://github.com/rahulc0dy/AVS-PEG/actions/workflows/build.yaml)
[![Lint](https://github.com/rahulc0dy/AVS-PEG/actions/workflows/lint.yaml/badge.svg)](https://github.com/rahulc0dy/AVS-PEG/actions/workflows/lint.yaml)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org/)
[![Three.js](https://img.shields.io/badge/Three.js-r180-049ef4?logo=three.js)](https://threejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-6-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Bun](https://img.shields.io/badge/Bun-1.3+-fbf0df?logo=bun)](https://bun.sh/)

**Autonomous Vehicle Simulator**

A browser-based 3D sandbox for designing road networks, placing traffic infrastructure, and running manual or AI-driven vehicle simulations. Build environments from scratch or import real-world layouts from OpenStreetMap, then train neural-network agents to navigate them autonomously.

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Environment Variables](#environment-variables)
  - [Running the Dev Server](#running-the-dev-server)
- [Usage](#usage)
  - [Environment Editor](#environment-editor)
  - [Manual Simulation](#manual-simulation)
  - [AI Training](#ai-training)
- [Project Structure](#project-structure)
- [Contributing](#contributing)
- [License](#license)

---

## Features

- **Road Generation** -- Edit a graph of nodes and edges; roads, intersections, lanes, and directional arrows are generated automatically.
- **Traffic Infrastructure** -- Place traffic lights, stop signs, source/destination markers, and user-defined waypoint paths.
- **OpenStreetMap Import** -- Fetch real-world road networks via the Overpass API and convert them into editable simulation environments.
- **Manual Driving** -- Take direct control of a vehicle with keyboard input and a first-person mini-camera viewport.
- **AI Training via Neuroevolution** -- Spawn populations of cars with feedforward neural networks. The best-performing brains are mutated across generations to evolve obstacle-avoidance and navigation behaviour.
- **Live Neural Network Inspector** -- Visualize activations, weights, and biases in real time. Scroll to edit individual parameters while the simulation runs.
- **Web Worker Physics** -- Vehicle physics (acceleration, friction, steering, collision detection, and neural network inference) run in dedicated Web Workers to keep the main thread responsive.
- **Undo/Redo** -- JSON-patch-based history for all editor operations.
- **Save/Load** -- Serialize the entire world state (graph, roads, markings, paths, neural networks) to JSON for persistence and sharing.

---

## Tech Stack

| Layer                        | Technology               |
| ---------------------------- | ------------------------ |
| Framework                    | Next.js 16 (App Router)  |
| UI                           | React 19                 |
| 3D Rendering                 | Three.js                 |
| Language                     | TypeScript 6             |
| Package Manager / Runtime    | Bun 1.3+                 |
| ML (traffic light detection) | TensorFlow.js + COCO-SSD |
| Styling                      | Tailwind CSS 4           |
| Environment Validation       | @t3-oss/env-nextjs + Zod |

---

## Architecture

```
Browser
  |
  +-- React UI (components/)
  |     |-- canvases/       Page-level Three.js canvases (render prop pattern)
  |     |-- hooks/          Bridges between simulation logic and React state
  |     |-- ui/             Reusable primitives (Button, Modal, Toast, ...)
  |     +-- world-ui/       Toolbars, panels, overlays
  |
  +-- Simulation Core (lib/)          [No React imports]
  |     |-- primitives/     Node, Edge, Graph, Polygon, Envelope
  |     |-- world/          World orchestrator, Road
  |     |-- editors/        GraphEditor, MarkingEditors, PathEditor, HistoryManager
  |     |-- markings/       TrafficLight, StopSign, Source, Destination, Path
  |     |-- systems/        TrafficLightSystem, PathFindingSystem, SpawnerSystem, TrainingSystem
  |     |-- car/            Car, Sensor, Controls, NetworkConfig
  |     +-- ai/             NeuralNetwork, Level
  |
  +-- Web Workers
        +-- car.worker.ts   Physics, collision detection, neural network inference
```

The simulation core in `lib/` is a pure TypeScript layer with no React dependencies. Each class manages its own Three.js meshes and exposes a `dispose()` method for cleanup. The 2D coordinate system uses `Node(x, y)` where `y` maps to the Three.js Z-axis at render time.

---

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/) >= 1.3.0 (or Node.js >= 24.0.0)
- A modern browser with WebGL and Web Worker support

### Installation

```bash
git clone https://github.com/rahulc0dy/AVS-PEG.git
cd AVS-PEG
bun install
```

### Environment Variables

Copy the example file and adjust values as needed:

```bash
cp .env.example .env.local
```

All client-side variables are prefixed with `NEXT_PUBLIC_` and validated at build time via `@t3-oss/env-nextjs`. Sensible defaults are provided, so the application runs without any manual configuration.

Key variable groups:

| Group                   | Controls                             |
| ----------------------- | ------------------------------------ |
| `ROAD_*`                | Road width, roundness, arrow spacing |
| `ORBIT_CAM_*`           | Orbit camera FOV, near/far planes    |
| `MINICAM_*`             | First-person mini-camera positioning |
| `MINIVIEW_*`            | Mini viewport size and position      |
| `CAR_*`                 | Acceleration, max speed, turn speed  |
| `WORLD_TRAFFIC_LIGHT_*` | Red/yellow/green phase durations     |

### Running the Dev Server

```bash
bun run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Other Commands

```bash
bun run build      # Production build
bun run start      # Start production server
bun run lint       # Run ESLint
```

---

## Usage

### Environment Editor

Navigate to `/edit` to open the graph-based environment editor.

- **Graph Mode** -- Click to place nodes, drag between nodes to create edges. Roads generate automatically along edges.
- **Marking Modes** -- Switch between traffic light, stop sign, and source/destination placement tools. Markings snap to road edges with directional previews.
- **Path Mode** -- Click graph nodes sequentially to define waypoint routes. Paths compute shortest-path connectivity via Dijkstra and render bordered lanes.
- **OSM Import** -- Open the import dialog, enter coordinates and a radius, and load real road data from OpenStreetMap.
- **Undo/Redo** -- `Ctrl+Z` / `Ctrl+Y` for full operation history.
- **Save/Load** -- Export the world state as JSON or load a previously saved file.

### Manual Simulation

Navigate to `/simulate` to drive a vehicle manually through the environment you built. A first-person mini-camera viewport provides a driver's-eye view alongside the orbit camera.

### AI Training

Navigate to `/train` to run neuroevolution training:

1. Cars spawn at source markings and attempt to reach destinations along defined paths.
2. Each car runs a feedforward neural network that reads sensor rays, marking detections, and speed telemetry.
3. The best-performing brain is preserved across generations with configurable mutation rates.
4. The neural network visualizer panel shows real-time activations, and individual weights and biases can be edited live by scrolling over connections or neurons.

---

## Project Structure

```
AVS-PEG/
|-- app/                      Next.js App Router pages
|   |-- layout.tsx            Root layout with metadata
|   |-- page.tsx              Landing page
|   |-- edit/                 Environment editor route
|   |-- simulate/             Manual driving route
|   +-- train/                AI training route
|-- components/
|   |-- canvases/             Page-level canvas components
|   |-- hooks/                React hooks bridging simulation and UI
|   |-- ui/                   Reusable UI primitives
|   +-- world-ui/             World interaction UI
|-- lib/                      Pure simulation logic (no React)
|   |-- ai/                   NeuralNetwork, Level
|   |-- car/                  Car, Sensor, Controls, car.worker.ts
|   |-- editors/              Editor classes and HistoryManager
|   |-- markings/             Marking types and Path
|   |-- primitives/           Node, Edge, Graph, Polygon, Envelope
|   |-- systems/              TrafficLight, PathFinding, Spawner, Training systems
|   +-- world/                World orchestrator, Road
|-- public/
|   +-- models/               GLTF 3D models
|-- services/                 External API integrations (OSM)
|-- styles/                   Global CSS
|-- types/                    Shared TypeScript type definitions
|-- utils/                    Pure utility functions
|-- env.ts                    Environment variable schema and validation
+-- package.json
```

---

## Contributing

Contributions are welcome. Please follow these guidelines:

1. **Fork** the repository and create a feature branch from `main`.
2. **Install dependencies** with `bun install`.
3. **Follow existing conventions:**
   - React components and hooks go in `components/`.
   - Pure simulation logic goes in `lib/` (no React imports).
   - Shared types go in `types/`.
   - Utility functions go in `utils/`.
   - Use the `@/` path alias for all project imports.
4. **Add JSDoc** to all new public functions and classes.
5. **Run the linter** before submitting: `bun run lint`.
6. **Open a pull request** with a clear description of the change.

For detailed architecture notes and coding conventions, see [AGENTS.md](AGENTS.md).

---

## License

This project is licensed under the [MIT License](LICENSE).
