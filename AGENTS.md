# Instructions for AI Agent

This modeller is used inside the Simulator (`Docs/external/bpmn-cpi-simulation`
there) and embedded by the pages that draw a run on a diagram: BOS and
UniversalSemantics. Code, comments, commit messages and documentation are
written in English.

## A diagram shows a run with TOKENS only: never colour a component

**Where a run is, what is running, what has finished is drawn by the tokens and
their counters, and by nothing else.** No BPMN element -- task, gateway, event,
flow, data object -- changes its stroke, fill, text colour, weight or outline
to say so: no `canvas.addMarker(id, '<highlight>')` with a CSS rule that paints
`.djs-visual`, no `modeling.setColor`, no `elementColors.add`, no class that
recolours an element while a run or a simulation moves.

It holds for this modeller and for every page that embeds it. The colours a
person gave an element in the model (its BPMN DI) are the model's, and stay as
drawn.

Daniel has said it again and again, and it was written in the documentation
each time: on 2026-10-29, for UniversalSemantics' Execution view, «non devi
colorare i componenti, esistono già i token»; and on 2026-11-09, on BOS's run
page, where the running task «Ingest sources» of «Excel to Dashboard» was drawn
with a green outline, green text and a green icon beside its token: «noi usiamo
solo i token, questo è stato scritto più e più volte nella docs». That green came
from the embedding page (BOS's `bpmn-highlight` marker), which is why the rule
names every page that draws this modeller and not only this repository.

THIS REPOSITORY ALREADY HOLDS COLOURING CODE, inherited from
`bpmn-js-token-simulation`: `lib/features/element-colors`,
`lib/features/show-scopes` (`highlightScope`),
`lib/features/exclusive-gateway-settings`,
`lib/features/inclusive-gateway-settings` and
`lib/features/neutral-element-colors`. None of it may be extended or newly used
to show where a run is. Whether the existing uses stay is Daniel's decision,
not an agent's.

Before adding ANY visual state to a diagram element, ask: is it a token? If it
is not, it is not added. A state the tokens cannot show is a question for
Daniel, not a colour.

THE HEATMAP STAYS, BY DANIEL'S DECISION OF 2026-11-16. `example/src/modeler.js`
draws a `heatmap.js` layer, `#heatmap-overlay`, over the diagram when a metric
is chosen in the «Heatmap» menu; it is off by default («Hide»). It shows
cumulative metrics -- token entries, the declared `sese:duration`, the declared
`sese:impact` values -- and never where a run is. It is an exception the owner
decided, not a precedent: no agent may extend it, copy it into another page or
module, or use it to show run state.

THE BRANCH COLOURING STAYS TOO, BY DANIEL'S DECISION OF 2026-11-16
(«Restano entrambi»). Two pieces of code recolour the outgoing sequence flows
of a gateway, and both stay:

1. upstream's `lib/features/exclusive-gateway-settings/ExclusiveGatewaySettings.js`,
   `setSequenceFlow`, whose `elementColors.add` at :112-120 runs when
   simulation mode turns on (`TOGGLE_MODE_EVENT` with `active: true`; the
   replay asks for the mode at every replay, and the event fires only when
   the mode was off). It colours each unlocked exclusive gateway's first
   outgoing flow `--token-simulation-active-outgoing-flow-stroke-color`
   (#212121) and the others `--token-simulation-inactive-outgoing-flow-stroke-color`
   (#909090). `lib/features/inclusive-gateway-settings/InclusiveGatewaySettings.js`
   does the same for inclusive gateways in `_setActiveOutgoing`: the
   non-default flows dark, the default flow grey;
2. this fork's replay, `example/src/modeler.js` `_replayFromStart`
   (:1112-1124 at c612f9d): after a snapshot, the branch an exclusive gateway
   took is drawn `--token-simulation-grey-darken-30` (#212121, #f1f1f1 in the
   dark theme) and its other outgoing flows #909090.

They recolour sequence-flow strokes only, never a shape. Like the heatmap they
are an exception the owner decided, not a precedent: no agent may extend them,
copy them to another element, page or module, or add colour anywhere else to
show where a run is. A loop's laps are shown by its token going round, not by
a colour.
