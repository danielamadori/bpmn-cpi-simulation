# Bad habits at `086f02868`, verified site by site

[bad_practices.md](bad_practices.md) is UES's `bad_habits_report` for revision
`086f02868` (run `20261116T150407Z_65d4a153`, 2026-11-16). It counts 94
violations. This file reads each of them in the code at that revision and says
what is to be fixed and what is not.

**How each site was checked.** The exact line of every hit comes from UES's own
walker (`_quiet_hits` in `scripts/ues/multi_lang_ast.py`, UES `0f2ea82`), run on
the same files, and its per-entity totals equal the report's. Each line was then
read in its function, its callers and the data that reaches it. **Nothing here
was reproduced in a browser:** every verdict comes from reading the code.

**Who owns a line.** 086f028 merges bpmn-js-token-simulation 1.1.0 (`b1ce5a9`).
A line is marked *upstream* when `git blame` names a commit that 1.1.0 already
contains; most of them sit in files that are byte-identical to 1.1.0. Changing
such a line forks this repository further from the upstream it has just merged,
so the fix belongs upstream, or the line is left as it is.

## Tally

| verdict | sites | what to do |
|---|--:|---|
| **Defect**: wrong today, with inputs the code receives today | 5 | fix |
| **Latent**: wrong only for an input no current caller sends | 10 | fix, after the defects |
| **Dead code**: in a file nothing imports | 6 | delete the two files (and a third with no hits) |
| **Rule only, fork code**: the rule holds, nothing behaves wrong | 43 | cleanup |
| **Rule only, upstream code** | 24 | leave, or report upstream |
| **False positive**: the rule misread the code | 6 | nothing |
| **total** | **94** | |

## 1. Defects (5 sites)

### D1. A request to move is dropped while a replay runs: `example/src/modeler.js:881` and `:1925`
*(rule `ts_console_log`, 2 sites; priority HIGH)*

What happens:
- `replayToIndex` returns at once while `_replayInProgress` is set.
- The `message` handler returns the same way for `{type: 'loadStates'}`.

In both cases the only trace is a `console.log`. The request is lost and is
not queued:
- the arrow navigation (`:2000`) still runs its `.then(() => updateNavigationUI())`;
- the embedding page (the Simulator's combined report,
  `src/sese_tooling/_combined_report_template.py:5806`) gets no answer.

Clicking a second node of the execution tree before the first replay has
finished leaves the tree on the new node and the diagram on the old one.

**Fix.** Keep the LATEST request in one pending slot and run it when the
current replay ends. If it is refused instead, refuse it visibly: an answer to
the host and a `console.warn`.

### D2. Element states are merged in key order: `example/src/modeler.js:1052` (`aggregateByElement`)
*(rule `catch_all_branch`; priority MEDIUM)*

The `else` merges a second token's status into its element's status, and it
decides only two of the ten ActivityState codes (`:1888-1897`):
- `ACTIVE` wins;
- `COMPLETED` beats anything but `ACTIVE`.

For the other eight (`UNKNOWN`, `SKIPPED`, `WAITING`, `COMPLETING`, `FAILING`,
`FAILED`, `TERMINATING`, `TERMINATED`) the first key read wins. So the result
depends on the order of the keys: `WAITING` then `FAILED` gives `WAITING`, and
`FAILED` then `WAITING` gives `FAILED`.

Three readers depend on that result:
- `diffCompletions`;
- `diffActivations`;
- the late-start test at `:2122` (`prevAgg[id] !== STATE_WAITING`).

**Fix.** One explicit precedence over all ten codes that raises on a code it
does not know. Which of `FAILED` and `ACTIVE` wins is a decision for Daniel,
not an agent's.

### D3. A failed late start is swallowed: `example/src/modeler.js:2127`
*(rule `ts_empty_catch`; priority MEDIUM)*

`try { simulationSupport.triggerElement(id); } catch(e) {}`, in the forward
step. When the start event of a late-starting process cannot be triggered, the
step goes on and the diagram leaves the snapshot without a word.

`waitForTokenDrain` handles the same failure in the same file (`:1128-1132`):
it retries, then reports with `console.error`.

**Fix.** Report it the way `waitForTokenDrain` does, naming the element and the
error.

### D4. A selection listener's exception disappears: `lib/features/selection-api/SelectionAPI.js:39`
*(rule `ts_empty_catch`; fork code; priority LOW-MEDIUM)*

Every listener registered through the selection API runs inside a `catch`
whose body is only a comment. A listener that throws (including one an
embedding page registers) fails silently every time.

**Fix.** Keep calling the other listeners, but `console.error` the exception
and name the listener.

## 2. Latent (10 sites)

| site | rule | what goes wrong, and when | fix |
|---|---|---|---|
| `example/src/modeler.js:905` | `silent_reconciliation` | `Math.min(targetIndex, stateSequence.length - 1)` turns an index past the end into the last snapshot. Today no host sends `targetIndex`: the combined report omits it, so `:1929`'s `parseInt(data.targetIndex, 10) \|\| (states.length - 1)` picks the last snapshot. But the same `\|\|` turns a `targetIndex` of **0** into the LAST index too | refuse an index outside `[0, length-1]`; replace the `\|\|` with an explicit «absent» test |
| `example/src/modeler.js:2019` | `silent_reconciliation` | step N is `_pathNodeIds[N-1]`, so the snapshots and the path ids must have the same length. The clamp hides a host that sends them out of step. `_allPathNodeIds[String(nodeId)] \|\| null` (`:330`, `:1283`, `:1962`) hides a missing node the same way | raise on the mismatch and on the missing node |
| `example/src/modeler.js:694` | `absent_as_zero` | a snapshot file not named `t<N>.json` sorts as `t0` and is loaded as a snapshot. Today every file in the 6 folders of `states/` (39 files) is `t<N>.json` | filter with the same pattern, and raise on a file that does not match |
| `example/src/modeler.js:1617` | `absent_as_zero` | a `sese:duration` with neither `max` nor `min` adds 0 to the heatmap's duration. The heatmap also uses `max` when both exist, which no comment says | raise on a duration with no bound; state which bound the heatmap shows |
| `example/src/modeler.js:1844` | `catch_all_branch` | every select value except `hide` becomes the metric. The options come from this file, but an unknown metric then reads 0 everywhere through `_readMetric`'s last `return 0` (`:1701`) | make `_readMetric` raise on a metric it does not know |
| `example/sidebar-controls.js:29` | `ts_empty_catch` | the comment says «canvas service not ready», but the `catch` swallows every error of `canvas.resized()` | test for the service, and drop the `catch` |
| `example/theme-toggle.js:14` | `ts_empty_catch` | «theming module not available», but it also swallows an error thrown by `setTheme` | the same: test for the module, do not `catch` the call |
| `tasks/ensure-rollup-binary.js:26` | `ts_empty_catch` | an unreadable `package-lock.json` silently falls back to the LOWER bound of `package.json`'s range. That can differ from the installed rollup, and rollup needs its native binary at exactly its own version. This script is `postinstall` | let a lock that exists but cannot be parsed fail the install |
| `tasks/ensure-rollup-binary.js:36` | `ts_empty_catch` | an unreadable `package.json` ends in a `console.warn` and `exit(0)`: the install succeeds without the binary, and the build fails later for a reason it does not name | fail the install |
| `tasks/ensure-rollup-binary.js:70` | `ts_empty_catch` | any error from `require(pkg)` (a broken or wrong-ABI binary, not only an absent one) is read as «not installed» | treat only `err.code === 'MODULE_NOT_FOUND'` as absent, and rethrow the rest |

## 3. Dead code (6 sites)

`example/src/api-client.js`, `example/src/bpmn-to-json.js` and
`example/src/sese-validator.js` came in with `de0fc9b` (2026-01-30, «fix»).
Searched in this repository's whole history (`git log --all -S`), at
086f02868, in BOS, in the Simulator and in UniversalSemantics:
- no module imports any of them;
- they are not webpack entries (`webpack.config.js` builds only
  `example/src/modeler.js` and `example/basic/src/app.js`);
- no HTML loads them.

`374ba47` (2026-06-16) still fixed `api-client.js`: work spent on code that
never runs.

| site | rule |
|---|---|
| `example/src/api-client.js:1` (3 parameters `= null`) | `default_param_none_default` |
| `example/src/bpmn-to-json.js:38` (`stopAtElement = null`) | `default_param_none_default` |
| `example/src/bpmn-to-json.js:74` | `ts_console_log` |
| `example/src/bpmn-to-json.js:102` (unknown element types skipped) | `catch_all_branch` |

The file `bpmn-to-json.js` also writes `duration: 1` and `impacts: [ 1 ]` for
every task, whatever its model declares. That is harmless only because nothing
calls it.

**Fix.** Delete the three files. Then correct the Simulator's two maps that
cite them as the parse path: `Docs/Paper/agent_maps/theory-to-code.mmd:15` and
`Docs/Paper/tools/generate_repository_maps.sh:145`. Those maps are the
Simulator's, so that correction goes to the Simulator, not here.

## 4. Rule only, fork code (43 sites)

| sites | rule | why nothing behaves wrong | cleanup |
|---|---|---|---|
| `example/src/modeler.js:1696`, `:1697` | `absent_as_zero` | `count` and `cumDuration` are created as 0 at `:1608` and only incremented, so the `\|\| 0` cannot fire | drop the `\|\| 0` |
| `example/src/modeler.js:1699` | `absent_as_zero` | an impact the element does not declare reads 0. `getHeatmapFrequencyData` (`:1780`) draws only `v > 0`, so «not declared» and «0» look the same | return `undefined` for «not declared», and test for it at `:1780` |
| `example/src/modeler.js:1078` (2) | `absent_as_zero` | an id missing from the registry sorts first, at `x = 0`. `waitForTokenDrain` reports it 50 lines later (`:1097`, `:1132`) | raise in the sort, or drop missing ids and report them before sorting |
| `example/src/modeler.js:192` | `default_param_empty_default` | `persist = false`, but its one caller (`:287`) always passes it | make it required |
| `example/src/modeler.js:879` | `default_param_empty_default` | `instant = false`: 1 call of 5 passes it, the other 4 rely on the default | pass `{ instant: false }` at the 4 calls |
| `example/src/modeler.js`, 35 `console.log` calls (all but `:881` and `:1925`, which are D1) | `ts_console_log` | diagnostic traces (`[StateLoader]`, `[replay]`, `[navFwd]`, `[PlayStates]`, `[DEBUG]` and others) in the page every host embeds. `:1293` («Pending states do not match current diagram») is a warning, not a trace | put the traces behind one debug switch; make `:1293` a `console.warn` |
| `example/basic/src/app.js:14` | `ts_console_log` | import warnings are logged at the `log` level | `console.warn` |

## 5. Rule only, upstream code (24 sites)

All of these are bpmn-js-token-simulation's own lines. None makes the
simulation wrong as it is used here.

- **`default_param_empty_default`, 9 sites:**
  - `lib/animation/Animation.js:429` (its one caller passes the value);
  - `lib/features/element-colors/ElementColors.js:126`, `:212`;
  - `lib/simulation-support/SimulationSupport.js:173`;
  - `lib/simulator/ScopeStates.js:39`;
  - `lib/simulator/Simulator.js:650`;
  - `lib/simulator/behaviors/InclusiveGatewayBehavior.js:214` (the recursion's
    `traversed` set, in the signature);
  - `src/icons/index.js:19`.
- **`default_param_none_default`, 8 sites,** where `null` is a real state
  (the root scope has no parent; «any element»):
  - `lib/simulation-support/SimulationSupport.js:115`, `:135`;
  - `lib/simulator/Scope.js:18` (2);
  - `lib/simulator/Simulator.js:575`;
  - `lib/simulator/behaviors/ActivityBehavior.js:151`;
  - `lib/simulator/behaviors/ScopeBehavior.js:32`, `:46`.
- **`ts_console_log`, 3 sites:** `lib/simulator/Simulator.js:893`, `:897`,
  `:901` («ignored #exit / #enter»).
- **`ts_todo_comment`, 5 sites.** Three of them name a known gap in the
  simulation's semantics, which matters to anyone who reads this modeller's
  replay as the run:
  - `lib/features/log/Log.js:343`: a terminate end event emits no trace event;
  - `lib/simulator/behaviors/ActivityBehavior.js:81`: a task with conditional
    outgoing flows is not given exclusive semantics;
  - `lib/simulator/behaviors/EventBehaviors.js:152`: an error with no catch
    does not always interrupt.

  The other two are `lib/simulation-support/SimulationSupport.js:36` and
  `lib/simulator/Simulator.js:832`.

## 6. False positives (6 sites)

| site | rule | why it is not one |
|---|---|---|
| `lib/animation/Animation.js:357` (upstream) | `absent_as_zero` | the first segment of a path starts at length 0: the zero is the answer |
| `lib/animation/Animation.js:389` (upstream) | `absent_as_zero` | the first part starts at time 0: the same |
| `example/src/modeler.js:1623` | `absent_as_zero` | `(m.cumImpact[name] \|\| 0) + val` starts an accumulator |
| `lib/features/keyboard-bindings/KeyboardBindings.js:69` (upstream) | `default_local_empty_fallback` | `isActive` is a state flag («simulation off»), which an event toggles. The rule's own text excludes flags |
| `tasks/sync-state-identifiers.js:34`, `:36` | `ts_console_log` | a command-line script, and those lines are its output |

## Seen while verifying (not counted by UES)

- **Fallbacks in the `loadStates` handler, `example/src/modeler.js:1928-1929`.**
  UES does not measure JavaScript's `||` and ternary fallbacks.
  - `Array.isArray(data.states) ? data.states : []` makes a malformed message
    an empty sequence.
  - `parseInt(data.targetIndex, 10) || (states.length - 1)` is the 0-becomes-last
    defect of the latent `:905`.
- **The heatmap draws a coloured layer over the diagram** (`heatmap.js`,
  `#heatmap-overlay`, `:1733`), and it fills while a replay moves. This
  repository's `AGENTS.md` allows only tokens to show a run. The heatmap shows
  cumulative metrics rather than where the run is, and it is off until chosen.
  Whether it stays is Daniel's decision.
