# AVS-PEG

(Autonomous Vehicle Simulation with Procedural Environment Generation)

## Graph Editor — save / load

The graph editor (at `/editor`) supports saving and loading the current graph:

- Save: stores the current graph snapshot to localStorage under `graph_snapshot`.
- Load: reads `graph_snapshot` from localStorage and rebuilds the scene.
- Export: downloads the graph JSON (`graph.json`).
- Import: load a previously exported JSON file.

Use the top-right controls in the editor UI to persist or retrieve graphs.
