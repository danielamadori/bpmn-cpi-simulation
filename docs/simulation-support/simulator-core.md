# Simulator Core

Notes on the core simulator files in `lib/simulator`, verified against the current source.

- **Simulator.js**  
  Central runtime and queue. Exposes `signal`, `enter`, `exit`, and `trigger` that behaviors call to advance execution; each call enqueues a job so work runs serially and emits a `tick` after batches. Creates scopes via `initializeScope`, wiring event subprocess start events and boundary events to subscriptions, and cleans them up through `destroyScope` (which cascades destruction and removes stale subscriptions based on required traits). Manages the event subscription system (`subscribe`, `trigger`, `findSubscription(s)`) with logic for interrupting vs. non-interrupting events, boundary vs. non-boundary precedence, and error/escalation matching by reference. Translates BPMN event definitions into internal `SimulatorEvent` objects via `getEvent`, including implicit message catches, compensation targets, and internal references for UI-driven triggers. Maintains per-element configuration (`setConfig`/`getConfig`, `waitAtElement`), waits for multiple scopes (`waitForScopes`), keeps change tracking for UI redraws, and initializes root scopes plus start event subscriptions on `reset`. Exposes a `registerBehavior` hook so behaviors can be bound to BPMN types.

- **Scope.js**  
  Represents an execution context bound to a BPMN element. Holds identifiers, parent/initiator pointers, children, subscriptions, and a `ScopeState`. Provides derived flags (`running`, `destroyed`, `completed`, `canceled`, `failed`, `active`) via `ScopeTraits`. State mutators (`start`, `complete`, `fail`, `cancel`, `terminate`, `compensable`, `destroy`) delegate to `ScopeState` transitions and record initiators for failure/cancel/terminate/destroy. Utility methods report live token counts overall or per element.

- **ScopeStates.js**  
  Implements the `ScopeState` class (name, trait bitmask, transition table) and the finite state graph. Defines states such as `ACTIVATED`, `RUNNING`, `COMPLETING`, `COMPLETED`, `FAILING`, `FAILED`, `CANCELING`, `TERMINATING`, `TERMINATED`, plus compensable variants. Each transition (`start`, `complete`, `fail`, `cancel`, `terminate`, `destroy`, `compensable`) enforces legal moves, raising an error on invalid transitions.

- **ScopeTraits.js**  
  Bitwise trait flags describing scope properties: `ACTIVATED`, `RUNNING`, `ENDING`, `ENDED`, `DESTROYED`, `FAILED`, `TERMINATED`, `CANCELED`, `COMPLETED`, `COMPENSABLE`, plus composite flags `ACTIVE` (activated|running|ending) and `NOT_DEAD` (activated|ended). Traits back `ScopeState.hasTrait` checks and filtering in the simulator.

- **index.js**  
  Entry point registering the simulator type in the DI container and depending on the behavior module. Subscribes to `tokenSimulation.toggleMode` and `tokenSimulation.resetSimulation` with high priority to invoke `simulator.reset()` whenever the UI toggles simulation mode or requests a reset.
