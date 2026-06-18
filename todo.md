#TODO list:

https://github.com/bpmn-io/bpmn-js-example


https://github.com/bpmn-io/bpmnlint

https://github.com/bpmn-io/bpmn-js-examples/tree/main/custom-modeling-rules


https://github.com/bpmn-io/bpmn-js-properties-panel?tab=readme-ov-file

https://github.com/bpmn-io/bpmn-js-example-react-properties-panel


## Hardcoded cleanup (from a cross-repo audit)

Actionable in THIS repo (it ships run.sh + docker-entrypoint.sh + the served frontend):
- **Port sprawl, no central config.** 8082 (modeller), 8083 (API), 8084 (CSTNU),
  6379 (Redis) are hardcoded across `run.sh`, `docker-entrypoint.sh` and the
  frontend, kept in sync by hand. In particular `docker-entrypoint.sh` defaults
  `PUBLIC_MODELLER_URL` to the literal `http://localhost:8082` instead of
  `http://localhost:$MODELLER_PORT`, so changing the port silently breaks the
  combined-report iframes. → introduce one source of truth (env/config) for the
  ports and derive the URLs from it.
- DONE: `example/src/api-client.js` no longer hardcodes `http://localhost:8765`
  — it now requires the page-injected `window._apiBaseUrl` and raises if absent,
  no silent fallback (commit 374ba47).

Tracked but NOT in this repo — these live in the Simulator backend repo, so the
agent here cannot fix them (cross-reference only, do not hunt for these files):
- `src/temporal/cstnu_store.py`: duplicated Redis/CSTNU URL defaults
  (`redis://localhost:6379/0`, `http://localhost:8084`) and a `5.0`s timeout
  duplicated with `cstnu_client.py` — should be env/config-driven.
- `src/parser/spin/converter/spin.py:42` `place.impacts = None` (the design uses
  `[]` for "not applicable"); plus the `... or []` impacts fallbacks in
  `parse_tree_spin.py` that can mask a missing-impacts construction error.
