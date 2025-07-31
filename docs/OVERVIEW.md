# Project Overview

This repository provides a **token simulator** extension for [bpmn-js](https://github.com/bpmn-io/bpmn-js). It allows BPMN 2.0 diagrams to be played back step by step so that users can explore execution semantics.

The project ships as an npm package (`bpmn-js-token-simulation`) and can be used in modelers and viewers alike. It bundles a set of features such as context pad controls, scope visualization, execution logging and a number of simulation helpers.

## Repository Structure

```
assets/       CSS assets used by the simulator
example/      Standalone demo application
lib/          Source code of the simulator and its features
  animation/  Animation helpers for token movement
  features/   Modular features like palette integration, logging and more
  simulator/  Core simulation engine and BPMN behaviors
  simulation-support/  APIs for driving simulations programmatically
src/icons/    SVG icons bundled with the library
docs/         Project documentation
```

The entry points are `lib/modeler.js` and `lib/viewer.js`, which integrate the simulator with a bpmn-js modeler or viewer instance.

## Development

```bash
npm install        # install dependencies
npm run dev        # run tests in watch mode
npm run start:example  # serve example application
```

Tests are run through Karma and rely on a headless Chrome. Linting uses ESLint and the project requires Node.js >= 16.

## Additional Documentation

* `docs/simulation-support/README.md` &ndash; describes the scripting API to drive simulations and introspect token flows.
* `CHANGELOG.md` &ndash; list of notable changes across releases.

