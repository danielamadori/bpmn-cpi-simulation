# Simulator Behaviors Overview

Notes from `lib/simulator/behaviors` based on the current source. Each section summarizes what the behavior registers with the simulator, how it reacts to lifecycle hooks (`enter`, `signal`, `exit`), and any notable edge cases.

- **index.js**  
  Central module that wires every behavior into the simulator. It imports all behavior classes and registers them in the DI container so they are instantiated (`__init__`) and available to handle their BPMN types.

- **ActivityBehavior.js**  
  Base behavior for all task-like elements (`bpmn:*Task`, `bpmn:CallActivity`). When a task is entered it optionally waits for a configured `wait` flag, otherwise it triggers pending message flows (computed left-to-right via waypoint positions) before handing off to `exit`. On `exit` it registers compensation for normal activities, activates outgoing sequence flows when the scope completed successfully, and delegates scope completion via `ScopeBehavior.tryExit` if no flows were taken. It also exposes `signalOnEvent` to subscribe to resume events and `_triggerMessages` to drive or await message flow exchanges in order.

- **BoundaryEventBehavior.js**  
  Handles `bpmn:BoundaryEvent`. On `signal`, it locates the host scope. If `cancelActivity` is true, it interrupts the host scope and waits for it to pre-exit before letting the boundary event complete; otherwise it simply exits. It delegates `exit` to `ActivityBehavior` so outgoing sequence flows and compensation registration behave like tasks.

- **EndEventBehavior.js**  
  Registers `bpmn:EndEvent`. Entry and signaling are delegated to `IntermediateThrowEventBehavior` so end events reuse throwing semantics (error, signal, etc.). On `exit`, it asks the parent scope to complete via `ScopeBehavior.tryExit`, which is how process completion is propagated.

- **EventBasedGatewayBehavior.js**  
  Registers `bpmn:EventBasedGateway`. On `enter` it subscribes to each outgoing catch event/receive task. When one triggers, it cancels the other subscriptions, destroys the current gateway scope, and signals the triggered target in the parent scope.

- **EventBehaviors.js**  
  Helper that dispatches logic for event definitions. It executes link throws (signals matching link catches in the same parent), broadcasts signals to all subscribed scopes once per scope, bubbles escalations and errors up the scope chain to the first subscribed ancestor, terminates the parent scope, triggers transaction cancel events, and orchestrates compensation by waiting for compensable scopes before triggering their handlers.

- **ExclusiveGatewayBehavior.js**  
  Registers `bpmn:ExclusiveGateway`. Acts as a pass-through on `enter`. On `exit`, if only one outgoing sequence flow exists it routes there; otherwise it reads `activeOutgoing` from simulator config to pick a branch. If none is configured it completes the gateway scope without progressing a token.

- **InclusiveGatewayBehavior.js**  
  Registers `bpmn:InclusiveGateway`. For splits, `exit` reads `activeOutgoing` (array) from config and enters each selected outgoing; with a single outgoing it behaves like an activity. For joins, `_tryJoin` analyzes incoming tokens and upstream reachability (including link events) to determine which sibling scopes are required before proceeding; once criteria are met it consumes one token per incoming flow, destroys joined child scopes, exits, and recursively checks any remaining scopes.

- **IntermediateCatchEventBehavior.js**  
  Registers `bpmn:IntermediateCatchEvent` and `bpmn:ReceiveTask`. Entry subscribes via `signalOnEvent` so the user must trigger the catch; `signal` and `exit` immediately pass control to the next element using `ActivityBehavior`.

- **IntermediateThrowEventBehavior.js**  
  Registers `bpmn:IntermediateThrowEvent` and `bpmn:SendTask`. On `enter` it consults `EventBehaviors` to execute the definition; if an event requires waiting (e.g., compensation) it subscribes via `signalOnEvent`. Otherwise it delegates to the normal activity lifecycle. `signal`/`exit` forward to `ActivityBehavior`.

- **SequenceFlowBehavior.js**  
  Registers `bpmn:SequenceFlow`. Simply exits on `enter` and, on `exit`, immediately enters the target element in the parent scope, carrying the originating scope as the initiator.

- **SubProcessBehavior.js**  
  Registers `bpmn:SubProcess`, `bpmn:Transaction`, and `bpmn:AdHocSubProcess`. Entry either waits if configured or starts execution. `_start` validates event sub-process constraints, sets up transaction handling when applicable, interrupts the parent when an interrupting start event fires, finds start nodes (explicit none-starts or implicit starts), and signals/enters them. On `exit` it recovers a parent scope that was failed by an event sub-process and delegates normal activity exit logic.

- **ProcessBehavior.js**  
  Registers `bpmn:Process` and `bpmn:Participant`. `signal` locates starting nodes (configured start event or default none/implicit starts) and signals or enters them to launch the instance. `exit` ensures any child scopes are destroyed when the root scope finishes.

- **MessageFlowBehavior.js**  
  Registers `bpmn:MessageFlow`. On `exit` of a send, it resolves the target catch element or message event key, looks up a matching subscription in the target or its parent, and triggers it so the receiving scope resumes. `signal` itself is a no-op that just completes the flow.

- **ParallelGatewayBehavior.js**  
  Registers `bpmn:ParallelGateway`. On `enter` it checks whether tokens arrived on all incoming sequence flows; if so, it completes any sibling scopes representing those tokens and exits. On `exit` it reuses `ActivityBehavior.exit`, which fans out along all outgoing sequence flows.

- **TransactionBehavior.js**  
  Transaction support helper. `setup` installs cancel and compensate listeners on the transaction scope. `cancel` marks the scope canceled, triggers compensation for registered activities, and re-triggers cancel to hit boundary cancel events. `registerCompensation` detects compensation handlers (embedded event sub-processes or boundary events), marks the transaction context compensable (keeping scopes alive), and subscribes compensation triggers so they can start compensation sub-processes or activities. `makeCompensable` propagates compensable traits up the scope chain, arranges compensate subscriptions that fail scopes and run compensation before exit, and ensures compensation can also be initiated from parent scopes. `findTransactionScope` walks up to the nearest transaction-capable scope. `compensate` triggers compensation subscriptions in a defined order (local first, then others) via `ScopeBehavior.preExit`.

- **StartEventBehavior.js**  
  Registers `bpmn:StartEvent`. On `signal` it immediately exits; `exit` delegates to `ActivityBehavior` so outgoing sequence flows are taken and compensation handling remains consistent.

- **ScopeBehavior.js**  
  Scope lifecycle helper. Provides `isFinished` and `destroyChildren`, interruption (`interrupt`), forced termination (`terminate`), and the central `tryExit` which checks whether a scope can exit, triggers pre-exit subscribers, and then calls `exit`. `preExit` lets behaviors register callbacks that must run before a scope leaves. `exit` forwards to the simulator so upstream elements can continue with the correct initiator.
