# Bad practices found by UES

UES's `bad_habits_report` on this repository at revision `75a4dc2e2`, run
`20261113T154256Z_56562016`, 2026-11-13 (see [the diagrams' README](diagrams/README.md)
for how the run was made and how to repeat it).

---
**Total violations:** 107 (107 production + 0 in test files)

> Test-file violations are shown separately and should not be treated as production debt.

  - high: 46
  - medium: 12
  - low: 49

**Rules with hits:** 9

**Python AST scan:** NOT CHECKED — 0 file(s) listed, 0 parsed (0 missing, 0 unreadable, 0 unparsable). A zero for `silent_fallback_get_no_default` below means nothing was looked at, not that nothing is there.

**Default-family scan beyond Python:** 116 of 116 listed file(s) parsed (116 javascript); 0 missing, 0 unreadable, 0 with no grammar installed (NOT CHECKED); 19 test file(s) left out, as for Python.

## Rule summary
| Severity | Rule | Violations | Entities | Description |
|---|---|---:|---:|---|
| high | `silent_reconciliation` | 17 | 7 | `min(a, b)` / `max(a, b)` over two non-constant sources — a disagreement about one quantity resolved without recording that it existed. The pick may be right; the silence is the defect. |
| high | `absent_as_zero` | 10 | 5 | `.get(k, 0)` or `… if xs else 0` — «not measured» rendered as «measured and it is zero». Zero is the perfect disguise, and it often coincides with the value that makes the check pass. |
| high | `default_param_empty_default` | 10 | 8 | A parameter whose default is `""`, `0`, `0.0`, `False` or an empty container -- `def parse(payload, base_dir: str = "")`. The callee fills in a caller's OMISSION with a value that reads as data, so «the caller passed nothing» and «the caller passed empty» become the same call, and every line downstream inherits the confusion. INSTEAD: make the parameter required; where leaving it out is a genuine state, take `Optional[T]` with NO default and ask `is None` where it is used, so each call site says which it means. State that only a recursion needs (a call stack, a restriction) belongs in a private entry point whose parameters are all required, not in the public signature. MEASURED 2026-10-27 over the tracked files outside tests, `str = ""` alone: 78 in the Simulator, 43 in UniversalSemantics, 26 in BOS. |
| high | `ts_empty_catch` | 6 | 4 | Empty or comment-only `catch` block silently swallows errors. |
| high | `catch_all_branch` | 2 | 2 | A final `else` closing a chain that dispatched on specific VALUES, assigning something specific and neither raising nor reporting: it does not mean «B», it means «anything that is not A is B» — a typo, a new value, the empty string. |
| high | `default_local_empty_fallback` | 1 | 1 | A local bound to an empty value and re-bound only under a condition -- `x = ""` then `if n is not None: x = text(n)`, or `if n is None: x = 0` / `else: x = n.line`. It is `x = v if test else ""` -- the `ternary_empty` form -- written as statements, and in this repository it was written that way to get past a gate that counts the ternary. A counter, an accumulator, a flag set inside a loop and a `None` the code later asks about are NOT this rule. INSTEAD: bind the name once, from the answer -- raise where the absence is a failure, or bind `None` and let the next line ask `is None` where it is a state. |
| medium | `default_param_none_default` | 12 | 7 | A parameter whose default is `None`. It cannot be mistaken for data, which is why it is not `high` -- but only where every reader asks `is None`; one `if x:` folds it back into the empty values. INSTEAD: a required parameter wherever the caller always knows; where absence is a real state, keep `Optional[T]` and drop the DEFAULT, so the absence is written at the call site instead of supplied by the callee. MEASURED 2026-10-27 outside tests: 160 in the Simulator, 198 in UniversalSemantics, 973 in BOS. |
| low | `ts_console_log` | 44 | 5 | `console.log(` in non-test code — use a structured logger instead. |
| low | `ts_todo_comment` | 5 | 5 | `// TODO` or `// FIXME` comment marks unfinished work. |

## What the code-quality rules did not measure
| Rule | Violations | Entities measured | Not measured | By language |
|---|---:|---:|---:|---|
| `bare_except` | 0 | 0 | 555 | javascript 550, batch 3, bash 2 |
| `global_mutable_state` | 0 | 0 | 555 | javascript 550, batch 3, bash 2 |
| `none_sentinel_default` | 0 | 0 | 555 | javascript 550, batch 3, bash 2 |
| `open_no_encoding` | 0 | 0 | 555 | javascript 550, batch 3, bash 2 |
| `raise_e_loses_trace` | 0 | 0 | 555 | javascript 550, batch 3, bash 2 |
| `silent_handler_no_body` | 0 | 0 | 555 | javascript 550, batch 3, bash 2 |
| `swallowed_handler` | 0 | 0 | 555 | javascript 550, batch 3, bash 2 |
| `basicconfig_module_top` | 0 | 0 | 555 | javascript 550, batch 3, bash 2 |
| `broad_exception` | 0 | 0 | 555 | javascript 550, batch 3, bash 2 |
| `dict_str_any_annotation` | 0 | 0 | 555 | javascript 550, batch 3, bash 2 |
| `json_loads_unguarded` | 0 | 0 | 555 | javascript 550, batch 3, bash 2 |
| `raise_without_from` | 0 | 0 | 555 | javascript 550, batch 3, bash 2 |
| `subprocess_no_timeout` | 0 | 0 | 555 | javascript 550, batch 3, bash 2 |
| `untyped_collection` | 0 | 0 | 555 | javascript 550, batch 3, bash 2 |
| `variadic_signature` | 0 | 0 | 555 | javascript 550, batch 3, bash 2 |
| `bare_star_separator` | 0 | 0 | 555 | javascript 550, batch 3, bash 2 |
| `chained_get_depth` | 0 | 0 | 555 | javascript 550, batch 3, bash 2 |
| `keyword_only_separator` | 0 | 0 | 555 | javascript 550, batch 3, bash 2 |
| `or_fallback_default` | 0 | 0 | 555 | javascript 550, batch 3, bash 2 |
| `print_for_diagnostics` | 0 | 0 | 555 | javascript 550, batch 3, bash 2 |
| `silent_return` | 0 | 0 | 555 | javascript 550, batch 3, bash 2 |
| `unused_exc_var` | 0 | 0 | 555 | javascript 550, batch 3, bash 2 |

## Worst offenders (top 10)
| # | Entity | Kind | File:line | Score | Total | Rules |
|---:|---|---|---|---:|---:|---|
| 1 | `/workspace/docs/generated/runs/20261113T154256Z_56562016/source/example/src/modeler.js` | file | /workspace/docs/generated/runs/20261113T154256Z_56562016/source/example/src/modeler.js:230 | 46 | 40 | ts_console_log(37), ts_empty_catch(1), default_param_empty_default(2) |
| 2 | `bpmnlint-plugin-sese.rules.no-diagram-overlaps.boundsOf` | function | /workspace/docs/generated/runs/20261113T154256Z_56562016/source/bpmnlint-plugin-sese/rules/no-diagram-overlaps.js:921 | 12 | 4 | silent_reconciliation(4) |
| 3 | `bpmnlint-plugin-sese.rules.no-diagram-overlaps.intersection` | function | /workspace/docs/generated/runs/20261113T154256Z_56562016/source/bpmnlint-plugin-sese/rules/no-diagram-overlaps.js:662 | 12 | 4 | silent_reconciliation(4) |
| 4 | `bpmnlint-plugin-sese.rules.no-diagram-overlaps.sharedPiece` | function | /workspace/docs/generated/runs/20261113T154256Z_56562016/source/bpmnlint-plugin-sese/rules/no-diagram-overlaps.js:794 | 9 | 3 | silent_reconciliation(3) |
| 5 | `example.src.modeler._readMetric` | function | /workspace/docs/generated/runs/20261113T154256Z_56562016/source/example/src/modeler.js:1671 | 9 | 3 | absent_as_zero(3) |
| 6 | `/workspace/docs/generated/runs/20261113T154256Z_56562016/source/lib/simulator/Simulator.js` | file | /workspace/docs/generated/runs/20261113T154256Z_56562016/source/lib/simulator/Simulator.js:893 | 9 | 6 | ts_console_log(3), ts_todo_comment(1), default_param_empty_default(1), default_param_none_default(1) |
| 7 | `/workspace/docs/generated/runs/20261113T154256Z_56562016/source/tasks/ensure-rollup-binary.js` | file | /workspace/docs/generated/runs/20261113T154256Z_56562016/source/tasks/ensure-rollup-binary.js:26 | 9 | 3 | ts_empty_catch(3) |
| 8 | `/workspace/docs/generated/runs/20261113T154256Z_56562016/source/lib/simulation-support/SimulationSupport.js` | file | /workspace/docs/generated/runs/20261113T154256Z_56562016/source/lib/simulation-support/SimulationSupport.js:36 | 8 | 4 | ts_todo_comment(1), default_param_empty_default(1), default_param_none_default(2) |
| 9 | `bpmnlint-plugin-sese.rules.no-diagram-overlaps.clipSegment` | function | /workspace/docs/generated/runs/20261113T154256Z_56562016/source/bpmnlint-plugin-sese/rules/no-diagram-overlaps.js:741 | 6 | 2 | silent_reconciliation(2) |
| 10 | `bpmnlint-plugin-sese.rules.no-diagram-overlaps.findJoin` | function | /workspace/docs/generated/runs/20261113T154256Z_56562016/source/bpmnlint-plugin-sese/rules/no-diagram-overlaps.js:838 | 6 | 2 | silent_reconciliation(2) |

_Severity weights: high=3, medium=2, low=1. Generated by bad_habits_report.py._
