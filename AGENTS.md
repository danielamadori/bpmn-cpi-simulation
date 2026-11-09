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
