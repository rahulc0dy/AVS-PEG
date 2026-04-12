# AVS-PEG

Autonomous Vehicle Simulation with Procedural Environment Generation.

AVS-PEG is a browser-based 3D sandbox for building road networks, placing traffic control markings, and running manual or AI-driven vehicle simulations.

## Stack

- Next.js 16 + React 19
- Three.js
- TypeScript
- Bun

## What it does

- Procedural road generation from graph edits
- Traffic-light, source/destination, and stop-sign marking tools
- Manual driving simulation
- AI training mode with neural-network visualization
- Save/load world state as JSON
- OpenStreetMap import support

## Run locally

```bash
bun install
bun run dev
```

Open `http://localhost:3000`.

## Routes

- `/` — Landing page
- `/edit` — Environment editor
- `/simulate` — Manual simulation
- `/train` — AI training mode
