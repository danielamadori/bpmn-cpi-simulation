# bpmn-js Token Simulation

[![CI](https://github.com/bpmn-io/bpmn-js-token-simulation/workflows/CI/badge.svg)](https://github.com/bpmn-io/bpmn-js-token-simulation/actions?query=workflow%3ACI)

A BPMN 2.0 specification compliant token simulator, built as a [bpmn-js](https://github.com/bpmn-io/bpmn-js) extension.

[![Screencast](docs/screenshot.png)](https://bpmn-io.github.io/bpmn-js-token-simulation/modeler.html?e=1&pp=1)

Try it on the [classic booking example](https://bpmn-io.github.io/bpmn-js-token-simulation/modeler.html?e=1&pp=1&diagram=https%3A%2F%2Fraw.githubusercontent.com%2Fbpmn-io%2Fbpmn-js-token-simulation%2Fmaster%2Ftest%2Fspec%2Fbooking.bpmn) or checkout the [full capability demo](https://bpmn-io.github.io/bpmn-js-token-simulation/modeler.html?e=1&pp=1&diagram=https%3A%2F%2Fraw.githubusercontent.com%2Fbpmn-io%2Fbpmn-js-token-simulation%2Fmaster%2Fexample%2Fresources%2Fall.bpmn).


## Installation

Install via [npm](http://npmjs.com/).

```
npm install bpmn-js-token-simulation
```


## Usage

Add as additional module to [bpmn-js](https://github.com/bpmn-io/bpmn-js).

### Modeler

```javascript
import BpmnModeler from 'bpmn-js/lib/Modeler';
import TokenSimulationModule from 'bpmn-js-token-simulation';

// optional color picker support
import ColorPickerModule from 'bpmn-js-color-picker';

const modeler = new BpmnModeler({
  container: '#canvas',
  additionalModules: [
    TokenSimulationModule,
    ColorPickerModule
  ]
});
```

Include the color picker stylesheet in your page:

```html
<link rel="stylesheet" href="node_modules/bpmn-js-color-picker/colors/color-picker.css" />
```

### Viewer

```javascript
import BpmnViewer from 'bpmn-js/lib/NavigatedViewer';
import TokenSimulationModule from 'bpmn-js-token-simulation/lib/viewer';

const viewer = new BpmnViewer({
  container: '#canvas',
  additionalModules: [
    TokenSimulationModule
  ]
});
```


## Build and Run

Prepare the project by installing all dependencies:

```sh
npm install
```

Then, depending on your use-case you may run any of the following commands:

```sh
# build the library and run all tests
npm run all

# run the full development setup
npm run dev

# spin up the example
npm run start:example

# start the basic token simulation example
npm run start:basic
```


To run the project inside a Docker container use:

```sh
./run.sh -p 8080
```

The script binds the application to port `8080` by default. To specify a different port:

```sh
./run.sh -p 9090
```

On Windows, use the batch script:

```cmd
run.bat -p 8080
```


## BPMN Linting

The example modeler ships with [bpmnlint](https://github.com/bpmn-io/bpmnlint) support.
Run `npm run start:example` and edit a diagram to see linting messages listed
in the top right corner. Customize the active rules inside `.bpmnlint.js`.
You may also consume linting results programmatically by listening to the
`linting.messages` event on the `eventBus`.


## Selection API

The library provides a `SelectionAPI` module that allows wrapper applications to monitor and interact with element selection in the BPMN diagram, similar to how the properties panel works.

### Getting Selected Elements

```javascript
// Get the SelectionAPI instance
const selectionAPI = modeler.get('selectionAPI');

// Get currently selected elements
const selectedElements = selectionAPI.getSelectedElements();
console.log('Selected:', selectedElements);

// Get single selected element (returns null if none or multiple selected)
const element = selectionAPI.getSelectedElement();

// Check if a specific element is selected
if (selectionAPI.isSelected('Task_1')) {
  console.log('Task_1 is currently selected');
}

// Get detailed selection information
const info = selectionAPI.getSelectionInfo();
// Returns: { count, elements, types, ids, businessObjects }
```

### Listening to Selection Changes

```javascript
// Register a listener for selection changes
const unsubscribe = selectionAPI.onSelectionChanged((newSelection, oldSelection) => {
  console.log('New selection:', newSelection.map(e => e.id));
  console.log('Previous selection:', oldSelection.map(e => e.id));
  
  // Update your wrapper application UI here
  updateMyUI(newSelection);
});

// Alias (same behavior):
// const unsubscribe = selectionAPI.subscribe((newSelection, oldSelection) => { ... });

// Later, to stop listening
unsubscribe();

// Alternative: Listen via eventBus
modeler.get('eventBus').on('tokenSimulation.selectionChanged', event => {
  console.log('Selection changed:', event.elements);
  console.log('Has selection:', event.hasSelection);
});
```

### Programmatically Selecting Elements

```javascript
// Select element by ID
selectionAPI.select('Task_1');

// Select multiple elements
selectionAPI.select(['Task_1', 'Task_2']);

// Select using element objects
const element = modeler.get('elementRegistry').get('Task_1');
selectionAPI.select(element);

// Clear selection
selectionAPI.clearSelection();
```

### Use Case: Integration with Wrapper Applications

The Selection API is designed for wrapper applications that need to:
- Display selected element details in custom panels
- Synchronize selection with external systems
- Track user interactions with the diagram
- Provide custom selection-based features

Example integration:

```javascript
// Initialize your wrapper application
modeler.on('import.done', () => {
  const selectionAPI = modeler.get('selectionAPI');
  
  // Expose to your wrapper application
  window.myApp = {
    getSelection: () => selectionAPI.getSelectedElements(),
    selectElement: (id) => selectionAPI.select(id),
    onSelectionChange: (callback) => selectionAPI.onSelectionChanged(callback)
  };
  
  // Listen to changes
  selectionAPI.onSelectionChanged((elements) => {
    // Update your custom properties panel
    myCustomPropertiesPanel.update(elements);
  });
});
```


## Exporting Diagrams

The example applications allow you to export the currently loaded BPMN diagram
as a PNG or SVG image via the [`bpmn-to-image`](https://github.com/bpmn-io/bpmn-to-image)
package. Use the _Export as PNG_ or _Export as SVG_ buttons in the demo UI
to trigger the download.

This feature relies on the [`@bpmn-io/add-exporter`](https://github.com/bpmn-io/add-exporter)
extension, which is already included in the examples, to embed exporter metadata
into the exported diagrams.

## Additional Resources

* [Talk: Making of token simulation](https://nikku.github.io/talks/2021-token-simulation) - The case for token simulation and how it builds on top of [bpmn-js](https://github.com/bpmn-io/bpmn-js)
* [Talk: Token simulation internals](https://nikku.github.io/talks/2021-token-simulation-internals) - Detailed walk through the simulators core
* [Talk: Your next BPMN engine](https://page.camunda.com/ccs2022-bpmn-js-token-simulation) - How we turned this project into a BPMN 2.0 spec compliant simulator
* [Camunda Modeler Token Simulation plug-in](https://github.com/camunda/camunda-modeler-token-simulation-plugin) - Token simulation for [Camunda](https://camunda.com/) users


## Licence

MIT
