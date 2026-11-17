# BPMN Simulator Documentation (Play State Sequence)

This documentation describes the operation of the "Play state sequence" mode of the BPMN simulator, focusing on the structure of the state JSON files and the behavior of components during the simulation.

## 1. Operational Overview

The simulator operates in a "manual" mode driven by predefined state snapshots. Instead of freely executing BPMN logic (based on timers, random rules, etc.), the simulator loads a sequence of JSON files from the `states/` folder and advances step by step through them.

The core of this logic lies in `example/src/modeler.js`, which acts as a "driver" for the simulation engine (`lib/simulator/Simulator.js`).

## 2. JSON Files Structure (`states/`)

State files are named in chronological sequence (e.g., `t0.json`, `t1.json`, ..., `t10.json`).

Each file represents a **full snapshot** of the state of all BPMN elements at that precise moment in time.

### Format

The format is a flat key-value JSON object:

```json
{
  "StartEvent_0offpno@Process_1.example#tok_0": 2,
  "Task_026c0id@Process_1.example#tok_0": 1,
  "ExclusiveGateway_13kuced@Process_1.example#tok_0": 0,
  "Task_1ept7kl@Process_1.example#tok_0": -1
}
```

(an excerpt of `states/example/t1.json`, which was removed on 2026-11-16 together
with its diagram `example/resources/example.bpmn`; every folder under `states/`
has the same format)

*   **Key**: `<elementId>@<context>#<tokenId>`, read by `parseStateKey` in `modeler.js`. The element ID (e.g., `Task_026c0id`) must match the ID in the `.bpmn` file exactly.
*   **Value**: The state of the element, as an integer `ActivityState` code -- the same codes the Simulator sends (`src/parser/activity_state.py` in the Simulator repository), so a file snapshot and an injected one are read by the same code.

### Possible States

*   `0` (waiting): The element is waiting (e.g., a token has arrived at the input but has not yet been processed/consumed).
*   `1` (active): The element is executing. For a task, this means the token is "inside" the task.
*   `2` (completed): The element has finished its execution.
*   `-1` (will not be executed): Explicitly indicates that a branch was not taken.

These files held the strings `"waiting"`, `"active"`, `"completed"` and `"will not be executed"` until 2026-11-16. `modeler.js` had compared integer codes since 2026-05-27, so a string snapshot matched nothing: no token moved and every row of the state panel read `unknown`.

## 3. Simulation Logic (`modeler.js`)

When the user clicks "Play state sequence", the system performs the following steps:

1.  **State Loading**: All `tX.json` files are loaded and sorted.
2.  **Initialization (t0)**:
    *   All diagram elements are configured in `wait: true` mode in the simulator. This forces tokens to stop at each element instead of flowing automatically.
    *   The visual state of `t0` is rendered in the monitoring table.
3.  **Advancement (tN -> tN+1)**:
    *   The system calculates the difference (**diff**) between the current state `N` and the next `N+1`.
    *   It identifies which elements have changed from `active` to `completed` or have become `active`.
    *   **Trigger**: Sends a signal (`simulationSupport.triggerElement` or `simulator.signal`) to the elements that need to advance.
    *   **An element that goes from `0` to `2` in ONE step is never triggered**, and the token stays where it is. A sequence this button can replay gives every task, send task, exclusive split and catch event a step where it is `1`. A start event is `2` in the step its first element becomes `1`. A parallel gateway, a join and an end event go from `0` to `2` in the step the token passes them, because they never hold a token. An exclusive split is steered by the element right after it that becomes `1` in the step the split goes to `2`. Measured 2026-11-17: the Simulator's export of the six `new_example/` diagrams, one step per execution-tree node, left the token on the first task of all six. Rewritten by hand one move per step, five of them play every step with the tokens on the active elements. `two_tasks_one_pool_in_a_loop` cannot be written this way: its decision gateway leads to two gateways that never hold a token.

## 4. Component Behavior

The components (defined in `lib/simulator/behaviors/`) react to simulator commands. Here is how they are adapted to follow the JSONs:

### `wait` Configuration
Since the simulator sets `wait: true` on almost all elements, every `Behavior` (such as `ActivityBehavior` or `ExclusiveGatewayBehavior`) executes the `waitAtElement` method:

```javascript
// Example internal logic
if (this._simulator.getConfig(element).wait) {
   // Suspends execution and waits for a new external signal (from the play button)
   return { type: 'continue', ... };
}
```

This allows the "Play" button to control exactly *when* a token moves from one node to another.

### Exclusive Gateways (`ExclusiveGateway`)
This is the most critical component. Normally, a gateway would decide the path based on conditions. In this mode, the path is **determined by the future**.

The `configureExclusiveGateways` function in `modeler.js`:
1.  Looks ahead in the JSON file sequence (e.g., from `t2` to `t10`).
2.  Identifies which outgoing branch becomes `active` after the gateway becomes `completed`.
3.  Configures the gateway in the simulator "on the fly":
    ```javascript
    simulator.setConfig(gateway, {
        locked: true,
        activeOutgoing: targetSequenceFlow, // Forces this path
        wait: true
    });
    ```
4.  When the gateway is executed, the `ExclusiveGatewayBehavior` reads `activeOutgoing` and forcibly routes the token to that branch, ignoring any other conditional logic.

### Tasks and Events
*   **Tasks**: Simply advance when they receive the "complete" signal from the simulation driver.
*   **Start Event**: Is manually triggered at the beginning of the sequence (transition from `t0` to `t1`).

### Paths a host sends, and the laps of a loop (`loop_moves`)
A host (the Simulator's combined report) does not use the `states/` files: it posts a `loadStates` message whose `states` is the path to one node of the execution tree, t0 then one step per node, and every step of it -- and of every path in `allPaths`, and the step an advance appends -- is

```json
{ "name": "t=0.000", "state": { "T2@P_ciclo.ciclo_condizionale#tok_0": 2 }, "loop_moves": [ "f_body" ] }
```

`loop_moves` is required, `[]` when the step crossed no loop decision, and `_readLoadStatesMessage` refuses a message with a step that lacks it. It lists the BPMN sequence flows the step's loop decisions took, in firing order (the Simulator's `_loop_moves_of`, `src/sese_tooling/_api/_snapshot_views.py`).

It exists because a snapshot cannot say it. A loop's decision gateway has no key in a snapshot, and a step's `state` is cumulative, so it says that a task completed and never how many times. Measured 2026-11-16 on the Simulator's `ciclo_condizionale.bpmn`: the replay sent the token round `f_body -> T2 -> f_back` forever, 297 laps in 10 s.

`example/src/loop-moves.js` is how the replay uses it:

*   an exclusive gateway no key names, with two outgoing flows or more, is a decision only the moves can resolve. The replay (`_replayFromStart`) queues the moves of steps 1..target under the gateway each flow leaves; every time a token enters such a gateway it takes the next queued flow, and with none queued it holds there, which is a decision still to be taken. A step forward (`navigateForward`) queues the moves of that one step, and a token already holding at a decision moves only if the step took it;
*   an exclusive gateway no key names, with one outgoing flow (a loop's exit gateway, a do-while's merge), lets the token through;
*   a move whose id carries a call scope (`CALL::f_body`) belongs to a called process, which this canvas does not draw, and steers nothing.

The token going round is what shows a lap: no element is coloured for it.

## Data Flow Summary

1.  **JSON Files** (`states/`) -> Define *what* must happen.
2.  **Modeler** (`modeler.js`) -> Reads JSONs, calculates the *delta*, configures gateways.
3.  **Simulator** (`Simulator.js`) -> Manages tokens and scopes.
4.  **Behaviors** (`lib/simulator/behaviors/*`) -> Execute the logic of each element, respecting `wait` constraints and forced paths.
