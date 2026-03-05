### The Inference Rules (Boolean Logic)

First, we define our **environmental conditions** (High = Clear/1, Low = Blocked/0).

- **ClearFront**: `ray[2] > 0.5`
- **DangerFront**: `ray[2] < 0.5`
- **DangerLeft**: `ray[0] < 0.6` OR `ray[1] < 0.6`
- **DangerRight**: `ray[4] < 0.6` OR `ray[3] < 0.6`
- **MovingFwd**: `speed ≥ 0`
- **MovingRev**: `speed < 0`

Next, we map these to **Outputs** using AND/OR gates:

- **`forward`** = `ClearFront`
- **`reverse`** = `DangerFront`
- **`right`** = (`DangerLeft` AND `MovingFwd`) OR (`DangerRight` AND `MovingRev`)
- **`left`** = (`DangerRight` AND `MovingFwd`) OR (`DangerLeft` AND `MovingRev`)

_(Note: The cross-wiring in the `left` and `right` rules perfectly handles Rule 6. If the car is backing up and there is danger on the right, it outputs `right`, which the physics engine inverts to turn the nose away from the danger)._

---

### The Architecture Map (Weights & Biases)

To implement this into the visualizer, we use **Hidden Layer 1** to detect the conditions, **Hidden Layer 2** to act as AND gates, and the **Output Layer** to act as OR gates.

#### Hidden Layer 1: Condition Sensors (6 Nodes)

_Since rays output `0` when an obstacle is close, we use negative weights and positive biases to trigger these nodes when a ray's value drops._

| Node     | Condition     | Connections (Source → Weight)                | Bias     | Logic                               |
| -------- | ------------- | -------------------------------------------- | -------- | ----------------------------------- |
| **H1_0** | `ClearFront`  | `ray[2]` → **1.0**                           | **-0.5** | Fires if front is clear.            |
| **H1_1** | `DangerFront` | `ray[2]` → **-1.0**                          | **0.5**  | Fires if front is blocked.          |
| **H1_2** | `DangerLeft`  | `ray[0]` → **-1.0** <br/>`ray[1]` → **-0.5** | **0.6**  | Fires if left side is blocked.      |
| **H1_3** | `DangerRight` | `ray[4]` → **-1.0** <br/>`ray[3]` → **-0.5** | **0.6**  | Fires if right side is blocked.     |
| **H1_4** | `MovingFwd`   | `speed` → **1.0**                            | **0.1**  | Fires if moving forward or stopped. |
| **H1_5** | `MovingRev`   | `speed` → **-1.0**                           | **-0.1** | Fires if moving in reverse.         |

#### Hidden Layer 2: Action "AND" Gates (6 Nodes)

_To create an AND gate with a bias limit of `[-1, 1]`, we use weights of `0.6` and a bias of `-0.8` (requiring both inputs to be active to surpass 0)._

| Node     | Action Intent | Connections (Source → Weight)          | Bias     | Logic                                 |
| -------- | ------------- | -------------------------------------- | -------- | ------------------------------------- |
| **H2_0** | `Go_Forward`  | `H1_0` → **1.0**                       | **-0.5** | Pass-through `ClearFront`.            |
| **H2_1** | `Go_Reverse`  | `H1_1` → **1.0**                       | **-0.5** | Pass-through `DangerFront`.           |
| **H2_2** | `SteerR_Norm` | `H1_2` → **0.6** <br/>`H1_4` → **0.6** | **-0.8** | Danger Left AND Moving Fwd.           |
| **H2_3** | `SteerL_Norm` | `H1_3` → **0.6** <br/>`H1_4` → **0.6** | **-0.8** | Danger Right AND Moving Fwd.          |
| **H2_4** | `SteerL_Inv`  | `H1_2` → **0.6** <br/>`H1_5` → **0.6** | **-0.8** | Danger Left AND Moving Rev (Rule 6).  |
| **H2_5** | `SteerR_Inv`  | `H1_3` → **0.6** <br/>`H1_5` → **0.6** | **-0.8** | Danger Right AND Moving Rev (Rule 6). |

#### Output Layer: Final Commands "OR" Gates (4 Nodes)

_These act as OR gates. If any connected hidden node fires, the output triggers._

| Output    | Command   | Connections (Source → Weight)          | Bias     |
| --------- | --------- | -------------------------------------- | -------- |
| **Out 0** | `forward` | `H2_0` → **1.0**                       | **-0.5** |
| **Out 1** | `left`    | `H2_3` → **1.0** <br/>`H2_4` → **1.0** | **-0.5** |
| **Out 2** | `right`   | `H2_2` → **1.0** <br/>`H2_5` → **1.0** | **-0.5** |
| **Out 3** | `reverse` | `H2_1` → **1.0**                       | **-0.5** |
