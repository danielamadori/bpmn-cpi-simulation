# Bad practices found by UES

UES's `bad_habits_report` on this repository at revision `b883dfb4c`, run
`20261116T230418Z_2b074c2d`, 2026-11-17, UES `fc40821` (see [the diagrams' README](diagrams/README.md)
for how the run was made and how to repeat it).

---
**Total violations:** 31 (31 production + 0 in test files)

> Test-file violations are shown separately and should not be treated as production debt.

  - high: 12
  - medium: 8
  - low: 11

**Rules with hits:** 6

**Python AST scan:** NOT CHECKED — 0 file(s) listed, 0 parsed (0 missing, 0 unreadable, 0 unparsable). A zero for `silent_fallback_get_no_default` below means nothing was looked at, not that nothing is there.

**Default-family scan beyond Python:** 114 of 114 listed file(s) parsed (114 javascript); 0 missing, 0 unreadable, 0 with no grammar installed (NOT CHECKED); 24 test file(s) left out, as for Python.

## Rule summary
| Severity | Rule | Violations | Entities | Description |
|---|---|---:|---:|---|
| high | `default_param_empty_default` | 8 | 7 | A parameter whose default is `""`, `0`, `0.0`, `False` or an empty container -- `def parse(payload, base_dir: str = "")`. The callee fills in a caller's OMISSION with a value that reads as data, so «the caller passed nothing» and «the caller passed empty» become the same call, and every line downstream inherits the confusion. INSTEAD: make the parameter required; where leaving it out is a genuine state, take `Optional[T]` with NO default and ask `is None` where it is used, so each call site says which it means. State that only a recursion needs (a call stack, a restriction) belongs in a private entry point whose parameters are all required, not in the public signature. MEASURED 2026-10-27 over the tracked files outside tests, `str = ""` alone: 78 in the Simulator, 43 in UniversalSemantics, 26 in BOS. |
| high | `absent_as_zero` | 3 | 2 | `.get(k, 0)` or `… if xs else 0` — «not measured» rendered as «measured and it is zero». Zero is the perfect disguise, and it often coincides with the value that makes the check pass. |
| high | `default_local_empty_fallback` | 1 | 1 | A local bound to an empty value and re-bound only under a condition -- `x = ""` then `if n is not None: x = text(n)`, or `if n is None: x = 0` / `else: x = n.line`. It is `x = v if test else ""` -- the `ternary_empty` form -- written as statements, and in this repository it was written that way to get past a gate that counts the ternary. A counter, an accumulator, a flag set inside a loop and a `None` the code later asks about are NOT this rule. INSTEAD: bind the name once, from the answer -- raise where the absence is a failure, or bind `None` and let the next line ask `is None` where it is a state. |
| medium | `default_param_none_default` | 8 | 5 | A parameter whose default is `None`. It cannot be mistaken for data, which is why it is not `high` -- but only where every reader asks `is None`; one `if x:` folds it back into the empty values. INSTEAD: a required parameter wherever the caller always knows; where absence is a real state, keep `Optional[T]` and drop the DEFAULT, so the absence is written at the call site instead of supplied by the callee. MEASURED 2026-10-27 outside tests: 160 in the Simulator, 198 in UniversalSemantics, 973 in BOS. |
| low | `ts_console_log` | 6 | 3 | `console.log(` in non-test code — use a structured logger instead. |
| low | `ts_todo_comment` | 5 | 5 | `// TODO` or `// FIXME` comment marks unfinished work. |

## What the code-quality rules did not measure
| Rule | Violations | Entities measured | Not measured | By language |
|---|---:|---:|---:|---|
| `bare_except` | 0 | 0 | 604 | javascript 599, batch 3, bash 2 |
| `global_mutable_state` | 0 | 0 | 604 | javascript 599, batch 3, bash 2 |
| `none_sentinel_default` | 0 | 0 | 604 | javascript 599, batch 3, bash 2 |
| `open_no_encoding` | 0 | 0 | 604 | javascript 599, batch 3, bash 2 |
| `raise_e_loses_trace` | 0 | 0 | 604 | javascript 599, batch 3, bash 2 |
| `silent_handler_no_body` | 0 | 0 | 604 | javascript 599, batch 3, bash 2 |
| `swallowed_handler` | 0 | 0 | 604 | javascript 599, batch 3, bash 2 |
| `basicconfig_module_top` | 0 | 0 | 604 | javascript 599, batch 3, bash 2 |
| `broad_exception` | 0 | 0 | 604 | javascript 599, batch 3, bash 2 |
| `dict_str_any_annotation` | 0 | 0 | 604 | javascript 599, batch 3, bash 2 |
| `json_loads_unguarded` | 0 | 0 | 604 | javascript 599, batch 3, bash 2 |
| `raise_without_from` | 0 | 0 | 604 | javascript 599, batch 3, bash 2 |
| `subprocess_no_timeout` | 0 | 0 | 604 | javascript 599, batch 3, bash 2 |
| `untyped_collection` | 0 | 0 | 604 | javascript 599, batch 3, bash 2 |
| `variadic_signature` | 0 | 0 | 604 | javascript 599, batch 3, bash 2 |
| `bare_star_separator` | 0 | 0 | 604 | javascript 599, batch 3, bash 2 |
| `chained_get_depth` | 0 | 0 | 604 | javascript 599, batch 3, bash 2 |
| `keyword_only_separator` | 0 | 0 | 604 | javascript 599, batch 3, bash 2 |
| `or_fallback_default` | 0 | 0 | 604 | javascript 599, batch 3, bash 2 |
| `print_for_diagnostics` | 0 | 0 | 604 | javascript 599, batch 3, bash 2 |
| `silent_return` | 0 | 0 | 604 | javascript 599, batch 3, bash 2 |
| `unused_exc_var` | 0 | 0 | 604 | javascript 599, batch 3, bash 2 |

## Worst offenders (top 10)
| # | Entity | Kind | File:line | Score | Total | Rules |
|---:|---|---|---|---:|---:|---|
| 1 | `lib/simulator/Simulator.js` | file | lib/simulator/Simulator.js:893 | 9 | 6 | ts_console_log(3), ts_todo_comment(1), default_param_empty_default(1), default_param_none_default(1) |
| 2 | `lib/simulation-support/SimulationSupport.js` | file | lib/simulation-support/SimulationSupport.js:36 | 8 | 4 | ts_todo_comment(1), default_param_empty_default(1), default_param_none_default(2) |
| 3 | `lib.animation.Animation` | module | lib/animation/Animation.js:1 | 6 | 2 | absent_as_zero(2) |
| 4 | `lib/features/element-colors/ElementColors.js` | file | lib/features/element-colors/ElementColors.js:126 | 6 | 2 | default_param_empty_default(2) |
| 5 | `lib/simulator/Scope.js` | file | lib/simulator/Scope.js:18 | 4 | 2 | default_param_none_default(2) |
| 6 | `lib/simulator/behaviors/ScopeBehavior.js` | file | lib/simulator/behaviors/ScopeBehavior.js:32 | 4 | 2 | default_param_none_default(2) |
| 7 | `example.src.modeler._recordMetricsForElement` | function | example/src/modeler.js:2007 | 3 | 1 | absent_as_zero(1) |
| 8 | `lib/simulator/behaviors/ActivityBehavior.js` | file | lib/simulator/behaviors/ActivityBehavior.js:81 | 3 | 2 | ts_todo_comment(1), default_param_none_default(1) |
| 9 | `lib/animation/Animation.js` | file | lib/animation/Animation.js:429 | 3 | 1 | default_param_empty_default(1) |
| 10 | `lib/simulator/ScopeStates.js` | file | lib/simulator/ScopeStates.js:39 | 3 | 1 | default_param_empty_default(1) |

_Severity weights: high=3, medium=2, low=1. Generated by bad_habits_report.py._
