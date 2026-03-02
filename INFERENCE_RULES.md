# Neural Network Inference Rules

Reference document for the AI car's neural network — its inputs, outputs, and the driving heuristics the network should learn through evolutionary training.

## Architecture

```
Inputs (6)        Hidden 1 (4)     Hidden 2 (4)     Hidden 3 (4)     Outputs (4)
 ┌──────────┐      ┌──────┐        ┌──────┐        ┌──────┐        ┌──────────┐
 │ ray[0]   │─────▶│      │───────▶│      │───────▶│      │───────▶│ forward  │
 │ ray[1]   │─────▶│      │───────▶│      │───────▶│      │───────▶│ left     │
 │ ray[2]   │─────▶│      │───────▶│      │───────▶│      │───────▶│ right    │
 │ ray[3]   │─────▶│      │───────▶│      │───────▶│      │───────▶│ reverse  │
 │ ray[4]   │─────▶│      │        │      │        │      │        └──────────┘
 │ speed    │─────▶│      │        │      │        │      │
 └──────────┘      └──────┘        └──────┘        └──────┘

Activation: step function — output = (weighted_sum > bias) ? 1 : 0
```

Network constructor: `NeuralNetwork([rayCount + 1, 4, 4, 4])`

---

## Inputs

### Sensor Rays (indices 0–4)

The car has **5 rays** cast from its position, spread evenly across a **120° arc** (`π / 1.5` radians) centred on its heading. Each ray extends up to **60 world units**.

| Index | Ray      | Direction (relative to heading) | Value             |
| ----- | -------- | ------------------------------- | ----------------- |
| 0     | `ray[0]` | Far left (−60°)                 | `offset ∈ [0, 1]` |
| 1     | `ray[1]` | Mid left (−30°)                 | `offset ∈ [0, 1]` |
| 2     | `ray[2]` | Centre (0°)                     | `offset ∈ [0, 1]` |
| 3     | `ray[3]` | Mid right (+30°)                | `offset ∈ [0, 1]` |
| 4     | `ray[4]` | Far right (+60°)                | `offset ∈ [0, 1]` |

**Offset meaning:**

- `0.0` — obstacle is touching the car
- `0.5` — obstacle is 30 units away (half ray length)
- `1.0` — no obstacle detected within ray range (clear)

**Obstacle types detected:**

- Path borders (road edge walls)
- Traffic car polygons (when `ignoreTraffic` is false)

### Speed (index 5)

| Index | Input             | Formula            | Range       |
| ----- | ----------------- | ------------------ | ----------- |
| 5     | `normalizedSpeed` | `speed / maxSpeed` | `[−0.5, 1]` |

- `1.0` — full forward speed
- `0.0` — stationary
- `−0.5` — full reverse speed (max reverse = half of max forward)

---

## Outputs

All outputs are **binary** (0 or 1) due to the step activation function.

| Index | Output    | Action when `1`                   |
| ----- | --------- | --------------------------------- |
| 0     | `forward` | Apply forward acceleration        |
| 1     | `left`    | Steer left (right when reversing) |
| 2     | `right`   | Steer right (left when reversing) |
| 3     | `reverse` | Apply reverse acceleration        |

**Note:** Steering direction is automatically inverted during reverse motion by the physics engine. When `speed < 0`, `left` input turns the car to the right and vice versa.

Multiple outputs can be active simultaneously (e.g., `forward=1, left=1` accelerates while turning left).

---

## Inference Rules

These are the driving heuristics a well-trained network should exhibit.

### Rule 1 — Wall Avoidance (core survival)

The most fundamental behaviour. Low ray offsets mean an obstacle is close.

| Condition                          | Expected Output       | Reasoning                       |
| ---------------------------------- | --------------------- | ------------------------------- |
| `ray[0]` low (left wall close)     | `right=1`             | Steer away from left wall       |
| `ray[4]` low (right wall close)    | `left=1`              | Steer away from right wall      |
| `ray[2]` low (wall straight ahead) | `left=1` or `right=1` | Turn to avoid head-on collision |
| `ray[2]` low, `ray[0] > ray[4]`    | `left=1`              | More space on left, turn left   |
| `ray[2]` low, `ray[4] > ray[0]`    | `right=1`             | More space on right, turn right |

### Rule 2 — Corridor Centering

Stay in the middle of the road for maximum reaction time.

| Condition                       | Expected Output          | Reasoning                           |
| ------------------------------- | ------------------------ | ----------------------------------- |
| `ray[0] ≈ ray[4]` (symmetrical) | `forward=1`, no steering | Centred in corridor, drive straight |
| `ray[0] < ray[4]` (drift left)  | `right=1`                | Correct toward centre               |
| `ray[4] < ray[0]` (drift right) | `left=1`                 | Correct toward centre               |

### Rule 3 — Speed Regulation

Manage speed based on road conditions ahead.

| Condition                      | Expected Output        | Reasoning                                 |
| ------------------------------ | ---------------------- | ----------------------------------------- |
| All rays high (open road)      | `forward=1`            | Safe to accelerate                        |
| `ray[2]` low, `speed` high     | `forward=0`            | Stop accelerating, let friction slow down |
| `ray[1]` and `ray[3]` moderate | `forward=1` (cautious) | Road narrowing but still passable         |

### Rule 4 — Turn Anticipation

React to curves before the wall is directly ahead.

| Condition                                     | Expected Output | Reasoning                             |
| --------------------------------------------- | --------------- | ------------------------------------- |
| `ray[0]`,`ray[1]` high; `ray[3]`,`ray[4]` low | `left=1`        | Road curves left — turn early         |
| `ray[3]`,`ray[4]` high; `ray[0]`,`ray[1]` low | `right=1`       | Road curves right — turn early        |
| Asymmetric readings with `ray[2]` still high  | Start turning   | Curve detected but wall not yet ahead |

### Rule 5 — Dead-End / Stuck Recovery

Recover when trapped or stalled.

| Condition                      | Expected Output         | Reasoning                  |
| ------------------------------ | ----------------------- | -------------------------- |
| `ray[2]` very low, `speed ≈ 0` | `reverse=1`             | Back up from dead end      |
| Reversing, side rays clearing  | `forward=1`, steer away | Resume forward motion      |
| All rays low (boxed in)        | `reverse=1`             | Only option is to back out |

### Rule 6 — Steering Inversion Awareness

The physics engine inverts steering when reversing.

| Condition                       | Expected Output | Reasoning                                                        |
| ------------------------------- | --------------- | ---------------------------------------------------------------- |
| `speed < 0`, need to turn left  | `right=1`       | Physics inverts: `right` input → actual left turn when reversing |
| `speed < 0`, need to turn right | `left=1`        | Physics inverts: `left` input → actual right turn when reversing |

---

## Physics Constants

These constants define how the car responds to control outputs.

| Parameter         | Value               | Effect                                     |
| ----------------- | ------------------- | ------------------------------------------ |
| `acceleration`    | `0.2` units/frame²  | Speed increase per frame when accelerating |
| `maxSpeed`        | `0.5` units/frame   | Forward speed cap                          |
| `maxReverseSpeed` | `−0.25` units/frame | Reverse speed cap (half of max forward)    |
| `friction`        | `0.05` units/frame² | Speed decay per frame (auto-deceleration)  |
| `TURN_RATE`       | `0.03` rad/frame    | Steering angular velocity                  |

---

## Sensor Configuration

| Parameter        | Value            | Description                              |
| ---------------- | ---------------- | ---------------------------------------- |
| `rayCount`       | `5`              | Number of sensor rays                    |
| `rayLength`      | `60`             | Maximum detection distance (world units) |
| `raySpreadAngle` | `π / 1.5` (120°) | Total angular spread of ray fan          |

---

## Training via Mutation

The network is trained through evolutionary mutation, not backpropagation.

1. Spawn N cars with copies of the best network from the previous generation
2. Apply `NeuralNetwork.mutate(network, amount)` to each copy
   - `amount ∈ (0, 1]` — strength of mutation
   - Each weight and bias is lerped toward a random value: `lerp(current, random(-1,1), amount)`
3. Run simulation; the car with highest `totalProgress` along the path becomes the best
4. Repeat with the best car's brain as the new base
