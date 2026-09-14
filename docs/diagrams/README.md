# Diagrams

Generated from this repository's source by
[UniversalSemantics](https://github.com/danielamadori/UniversalSemantics)
on 2026-09-14, and committed because they are **reproducible**: the same
source produces byte-identical files, so a diff between two
regenerations shows what changed in the code and nothing else.

## What is here

| file | what it shows |
|---|---|
| `ast-class_diagram.*` | types with their members, plus one box per module holding that module's free functions (`<<javascript module>>`) |
| `ast-call_graph.*` | who calls whom |
| `ast-component_diagram.*` | one component per file, with its function count |
| `ast-package_diagram.*` | packages and their import dependencies |
| `state_diagram.*` | the MDP built from the BPMN model of this code |

Three formats each where the view has something to draw in all three:
`.mmd` (Mermaid -- GitHub renders it inline), `.puml` (PlantUML),
`.dot` (Graphviz).

## Read line 2 before quoting a number

**Every file that shows less than all of its subject says so on line
2.** A file without such a header is complete.

- the call graph is a top-degree induced subgraph -- 100 of 743 nodes, 200 of 1021 edges, so it
  answers "what are the hot paths" and does not answer "what
  calls this";
- the state diagram is diagram shows first 500 states only;
- the class diagram carries no shortfall header, so every entity
  the extractor found is drawn. The 84 boxes include one synthetic
  box per module for that module's free functions, so the box
  count is larger than the entity count by construction.

This repository holds javascript.

## What was measured on this repository

From run `20260914T185300Z_3f38fd1b` (2026-09-14): **19 of 21 pipeline steps succeeded**.

- every class-like entity the extractor found is drawn, in 84 boxes;
- coherence audit PASS (24 passed, 0 warned, 0 failed, 9 n/a);
- `simulate_bpmn`: Fleet: 154/314 process(es) simulated [shape filter: 154 eligible, 2411/3341 flow nodes = 72.2% of the model], 3674 total nodes
- `ltl_check`: LTL₄ check: 56 properties, scope=primary_process. Decided: 0 (⊤ 0, ⊥ 0); inconclusive on the finite prefix: 56 (⊤_p 3, ⊥_p 53). Violations: none
  "Violations: none" here means **nothing was decided**, not
  that nothing is wrong.
- `strategy_synthesis`: Strategy synthesis: no strategy under the given bounds (reason_kind=incomplete_frontier, frontiers=23, details_keys=['P_sum', 'missing_saturate_ids', 'note'])

Two steps did not succeed, and neither is a defect in this
repository's code:

- `llm_enrich` **failed** because no LLM endpoint is reachable from
  the analysis container (`UES_LLM_ENDPOINT` unset; `localhost`
  inside a container is the container itself). It refuses rather than
  writing an unenriched file and reporting success.
- `verification_report` **skipped**: verification_report SKIPPED: no behavior export. `export_prism` is off by default since 2026-09-03 and it is the only producer of `mdp.metadata.json`, which is this report's input. Add "export_prism" to `steps` to get the report back. This is not a verification that passed -- it is one that never ran.

## Regenerating

From a UniversalSemantics checkout with its server running, and with
this machine's repositories visible to the container at `/projects`:

```bash
curl -s -X POST http://127.0.0.1:8050/api/runs \
  -H "Content-Type: application/json" \
  -d '{"name":"bpmn-cpi-simulation","inputs":{"source_root":"/projects/bpmnpy/server/gui/vendor/Simulator/Docs/external/bpmn-cpi-simulation"}}'

python3 scripts/ues/ast_to_uml.py \
    docs/generated/runs/<run_id>/ast/ast.json <staging_dir> \
    --source-root /projects/bpmnpy/server/gui/vendor/Simulator/Docs/external/bpmn-cpi-simulation
```

`--source-root` is what keeps the container's mount point out of the
committed files; without it every provenance comment reads
`/projects/bpmnpy/server/gui/vendor/Simulator/Docs/external/bpmn-cpi-simulation/<file>:<line>` instead of `<file>:<line>`.

Copy the `.mmd`, `.puml` and `.dot` files from `<staging_dir>` to
`docs/diagrams/`, prefixing the AST views with `ast-`. The JSON maps,
`cytoscape.json` and `processes.bpmn` stay out -- they are for
machines, not for reading.

### There is no `source-*` family here, on purpose

Some sibling repositories carry a second `source-*` set from the
Python-only pass. That pass (`source_uml`) is scheduled **only** on
the archive route, so a `source_root` run like this one cannot
produce it. Committing half a set -- a fresh `ast-*` beside a
`source-*` from a different day -- looks coherent and is not, so
this set is `ast-*` only and says so.
