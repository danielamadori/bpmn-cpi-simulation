# Diagrams

Generated from this repository's source by
[UniversalSemantics](https://github.com/danielamadori/UniversalSemantics) on
2026-11-13, at revision `75a4dc2e2`, and committed because they are reproducible:
the provenance comments name files the way this repository does, not the way
one machine happened to mount them. Regenerate them rather than editing them.

## What is here

| file | what it shows | formats |
|---|---|---|
| `ast-class_diagram.*` | types with their members | .dot, .mmd, .puml |
| `ast-call_graph.*` | who calls whom | .dot, .mmd, .puml |
| `ast-component_diagram.*` | one component per file, with its function count | .dot, .mmd, .puml |
| `ast-package_diagram.*` | packages and their import dependencies | .dot, .mmd, .puml |
| `state_diagram.*` | the MDP built from the BPMN model of this code | .mmd, .puml |

## Read the header before quoting a number

A file that shows less than all of its subject, or that a viewer will not
render, says so in its first lines:

- `ast-call_graph`
  - `.dot`: 398 of 1720 call records rendered, of which 0 are an identifier PASSED AS AN ARGUMENT and not a call at that site (dashed, and their tooltip says so); 398 are call sites.
  - `.mmd`: OVER MERMAID'S DEFAULT LIMIT: 125225 characters of diagram, plus 861 for these two lines, is 126086 against a 50000-character default (over by 76086, x2.5).
- `state_diagram`
  - `.mmd`: OVER MERMAID'S DEFAULT LIMIT: 412548 characters of diagram, plus 862 for these two lines, is 413410 against a 50000-character default (over by 363410, x8.3).

The JSON maps (`uml_map.json`, `cytoscape.json`, `state_diagram_map.json`) and
`processes.bpmn` are deliberately not committed: they are for machines, and a run
produces them afresh.

## What UES read and ran

- A code-only archive of `75a4dc2e2`: 138 files, 0.5 MB of source (uncompressed), 139 ZIP entries including .ues_corpus_provenance.json, built with UES's
  `scripts/dev/build_corpus_zip.py --audit --require-single-revision`.
- Run `20261113T154256Z_56562016` on the Aruba Virtual Private Server, deleted once its
  outputs were copied. Steps, and how each ended:

  - `unzip_archive`: succeeded
  - `source_ast`: succeeded
  - `compile_ast_ues`: succeeded
  - `shared_state_extract`: succeeded
  - `bad_habits_report`: succeeded
  - `source_uml`: succeeded
  - `ast_uml`: succeeded
  - `ast_to_bpmn`: succeeded
  - `bpmn_to_mdp`: succeeded
  - `state_diagram`: succeeded
  - `render_diagram_svg`: succeeded

- The IR the steps read:

  - Entities: 888 (source 555, synthetic modules 0, external stubs 333)
  - Relations: 1606
  - CFGs: 412 (3490 nodes, 3534 edges)
  - ICFG call edges: 397

Bad practices found in the same run are in
[bad_practices.md](../bad_practices.md).

## Regenerating

1. In a UniversalSemantics checkout: `python3 scripts/dev/build_corpus_zip.py
   <this checkout> -o <name>_<sha>.zip --audit --require-single-revision`.
2. Upload the archive to UES and start a run with `inputs.archive` set to it and
   the steps `unzip_archive, source_ast, compile_ast_ues, shared_state_extract,
   bad_habits_report, source_uml, ast_uml, ast_to_bpmn, bpmn_to_mdp,
   state_diagram, render_diagram_svg`.
3. Copy `uml_ast/<view>.{dot,mmd,puml}` here as `ast-<view>.*` and
   `uml/state_diagram.{mmd,puml}` as they are, leaving out any file that holds
   only the renderer's scaffolding.
