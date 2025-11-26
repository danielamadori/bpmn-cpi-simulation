
/* global process */

import TokenSimulationModule from '../..';

import BpmnModeler from 'bpmn-js/lib/Modeler';

import AddExporter from '@bpmn-io/add-exporter';

import {
  BpmnPropertiesPanelModule,
  BpmnPropertiesProviderModule
} from 'bpmn-js-properties-panel';

import SimulationSupportModule from '../../lib/simulation-support';

import fileDrop from 'file-drops';

import fileOpen from 'file-open';

import download from 'downloadjs';
import { svgToPng } from './utils';
import gridModule from 'diagram-js-grid';
import ColorPickerModule from 'bpmn-js-color-picker';
import SketchyModule from 'bpmn-js-sketchy';
import minimapModule from 'diagram-js-minimap';
import BpmnLintModule from 'bpmn-js-bpmnlint';
import exampleXML from '../resources/example.bpmn';

const url = new URL(window.location.href);

const persistent = url.searchParams.has('p');
const active = url.searchParams.has('e');
const presentationMode = url.searchParams.has('pm');

let fileName = 'diagram.bpmn';

const initialDiagram = (() => {
  try {
    return persistent && localStorage['diagram-xml'] || exampleXML;
  } catch (err) {
    return exampleXML;
  }
})();

function showMessage(cls, message) {
  const messageEl = document.querySelector('.drop-message');

  if (!messageEl) {
    console.error(message);
    return;
  }

  messageEl.textContent = message;
  messageEl.className = `drop-message ${cls || ''}`;

  messageEl.style.display = 'block';
}

function hideMessage() {
  const messageEl = document.querySelector('.drop-message');

  if (!messageEl) {
    return;
  }

  messageEl.style.display = 'none';
}

if (persistent) {
  hideMessage();
}

const ExampleModule = {
  __init__: [
    [ 'eventBus', 'bpmnjs', 'toggleMode', function(eventBus, bpmnjs, toggleMode) {

      if (persistent) {
        eventBus.on('commandStack.changed', function() {
          bpmnjs.saveXML().then(result => {
            localStorage['diagram-xml'] = result.xml;
          });
        });
      }

      if ('history' in window) {
        eventBus.on('tokenSimulation.toggleMode', event => {

          document.body.classList.toggle('token-simulation-active', event.active);

          if (event.active) {
            url.searchParams.set('e', '1');
          } else {
            url.searchParams.delete('e');
          }

          history.replaceState({}, document.title, url.toString());
        });
      }

      eventBus.on('diagram.init', 500, () => {
        toggleMode.toggleMode(active);
      });
    } ]
  ]
};

const modeler = new BpmnModeler({
  container: '#canvas',
  additionalModules: [
    BpmnPropertiesPanelModule,
    BpmnPropertiesProviderModule,
    TokenSimulationModule,
    AddExporter,
    ColorPickerModule,
    SketchyModule,
    gridModule,
    SimulationSupportModule,
    ExampleModule,
    minimapModule,
    BpmnLintModule
  ],
  propertiesPanel: {
    parent: '#properties-panel'
  },
  linting: {
    active: true
  },
  exporter: {
    name: 'bpmn-js-token-simulation',
    version: process.env.TOKEN_SIMULATION_VERSION
  }
});

const lintingMessagesEl = document.querySelector('#linting-messages');

modeler.get('eventBus').on('linting.messages', ({ issues }) => {
  const messages = Object.keys(issues).reduce((all, id) => {
    issues[id].forEach(issue => all.push(`${issue.id}: ${issue.message}`));
    return all;
  }, []);

  lintingMessagesEl.innerHTML = messages.length
    ? `<ul>${messages.map(m => `<li>${m}</li>`).join('')}</ul>`
    : 'No linting issues';
});

function openDiagram(diagram) {
  return modeler.importXML(diagram)
    .then(({ warnings }) => {
      if (warnings.length) {
        console.warn(warnings);
      }

      if (persistent) {
        localStorage['diagram-xml'] = diagram;
      }

      modeler.get('canvas').zoom('fit-viewport');
    })
    .catch(err => {
      console.error(err);
    });
}

if (presentationMode) {
  document.body.classList.add('presentation-mode');
}

function openFile(files) {

  // files = [ { name, contents }, ... ]

  if (!files.length) {
    return;
  }

  hideMessage();

  fileName = files[0].name;

  openDiagram(files[0].contents);
}

document.body.addEventListener('dragover', fileDrop('Open BPMN diagram', openFile), false);

function downloadDiagram() {
  modeler.saveXML({ format: true }).then(({ xml }) => {
    download(xml, fileName, 'application/xml');
  });
}

function exportPNG() {
  modeler.saveSVG().then(({ svg }) => {
    svgToPng(svg).then(png => {
      download(png, fileName.replace(/\.bpmn$/i, '.png'), 'image/png');
    });
  });
}

function exportSVG() {
  modeler.saveSVG().then(({ svg }) => {
    download(svg, fileName.replace(/\.bpmn$/i, '.svg'), 'image/svg+xml');
  });
}

document.body.addEventListener('keydown', function(event) {
  if (event.code === 'KeyS' && (event.metaKey || event.ctrlKey)) {
    event.preventDefault();

    downloadDiagram();
  }

  if (event.code === 'KeyO' && (event.metaKey || event.ctrlKey)) {
    event.preventDefault();

    fileOpen().then(openFile);
  }
});

document.querySelector('#download-button').addEventListener('click', function(event) {
  downloadDiagram();
});

document.querySelector('#export-png').addEventListener('click', function(event) {
  exportPNG();
});

document.querySelector('#export-svg').addEventListener('click', function(event) {
  exportSVG();
});

// move simulation UI controls (toggle + animation speed) into a dedicated left gutter stack
const controlStack = document.getElementById('simulation-control-stack');
const animWrapper = document.getElementById('control-anim-wrapper');

function moveSimulationControls() {
  const toggle = document.querySelector('.bts-toggle-mode');
  const speed = document.querySelector('.bts-set-animation-speed');

  if (toggle && toggle.parentNode !== controlStack) {
    // keep original styling, only move into stack at the top
    controlStack.prepend(toggle);
  }

  if (speed && animWrapper && speed.parentNode !== animWrapper) {
    // keep original styling, place inside limited-height wrapper
    animWrapper.appendChild(speed);
  }
}

const controlsObserver = new MutationObserver(() => moveSimulationControls());
controlsObserver.observe(document.body, { childList: true, subtree: true });

// --- state sequence playback (drives tokens from JSON snapshots) ---

const playStatesBtn = document.getElementById('play-state-sequence');
const statePanel = document.getElementById('state-panel');
const statePanelTitle = document.getElementById('state-panel-title');
const statePanelBody = document.getElementById('state-panel-body');
const elementRegistry = () => modeler.get('elementRegistry');

// load all JSON state snapshots from /states in lexicographic order
const statesContext = require.context('../../states', false, /\.json$/);
const stateSequence = statesContext.keys().sort().map(key => ({
  name: key.replace('./', '').replace('.json', ''),
  state: statesContext(key)
}));

function showStatePanelMessage(message) {
  if (!statePanel || !statePanelBody) {
    return;
  }

  statePanel.classList.add('visible');

  if (statePanelTitle) {
    statePanelTitle.textContent = 'State sequence';
  }

  statePanelBody.innerHTML = '';

  const row = document.createElement('tr');
  const cell = document.createElement('td');
  cell.colSpan = 2;
  cell.className = 'state-panel-empty';
  cell.textContent = message;

  row.appendChild(cell);
  statePanelBody.appendChild(row);
}

function normalizeStatusClass(status) {
  return `state-status-${status.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
}

function renderStateSnapshot(snapshot) {
  if (!snapshot || !statePanel || !statePanelBody) {
    return;
  }

  statePanel.classList.add('visible');

  if (statePanelTitle) {
    statePanelTitle.textContent = `State: ${snapshot.name}`;
  }

  statePanelBody.innerHTML = '';

  const entries = Object.entries(snapshot.state).sort(([a], [b]) => a.localeCompare(b));

  if (!entries.length) {
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = 2;
    cell.className = 'state-panel-empty';
    cell.textContent = 'Nessuna attivita\u0300 nello snapshot';
    row.appendChild(cell);
    statePanelBody.appendChild(row);
    return;
  }

  entries.forEach(([taskId, status]) => {
    const row = document.createElement('tr');
    const taskCell = document.createElement('td');
    const statusCell = document.createElement('td');

    const element = elementRegistry().get(taskId);
    const displayName = element && element.businessObject && element.businessObject.name
      ? element.businessObject.name
      : taskId;

    taskCell.textContent = displayName;
    statusCell.textContent = status;
    statusCell.classList.add(normalizeStatusClass(status));

    row.appendChild(taskCell);
    row.appendChild(statusCell);

    statePanelBody.appendChild(row);
  });
}

function diffCompletions(prev, next) {
  return Object.keys(next).filter(id => prev[id] === 'active' && next[id] === 'completed');
}

async function waitForTokenDrain(simulationSupport, ids) {
  for (const id of ids) {
    simulationSupport.triggerElement(id);
    await simulationSupport.elementExit(id);
  }
}

async function playStates() {
  const simulationSupport = modeler.get('simulationSupport');

  // ensure simulation is active
  simulationSupport.toggleSimulation(true);

  if (!stateSequence.length) {
    console.warn('No state snapshots found in /states');
    showStatePanelMessage('Nessuno snapshot trovato in /states');
    return;
  }

  // kick things off by triggering the main start event
  simulationSupport.triggerElement('StartEvent_0offpno');

  renderStateSnapshot(stateSequence[0]);

  for (let i = 1; i < stateSequence.length; i++) {
    const prev = stateSequence[i - 1].state;
    const nextSnapshot = stateSequence[i];
    const next = nextSnapshot.state;
    const completions = diffCompletions(prev, next);

    if (completions.length) {
      await waitForTokenDrain(simulationSupport, completions);
    }

    renderStateSnapshot(nextSnapshot);
  }
}

playStatesBtn.addEventListener('click', () => {
  playStates().catch(err => console.error('State playback failed', err));
});


const propertiesPanel = document.querySelector('#properties-panel');

const propertiesPanelResizer = document.querySelector('#properties-panel-resizer');

let startX, startWidth;

function toggleProperties(open) {

  if (open) {
    url.searchParams.set('pp', '1');
  } else {
    url.searchParams.delete('pp');
  }

  history.replaceState({}, document.title, url.toString());

  propertiesPanel.classList.toggle('open', open);
}

propertiesPanelResizer.addEventListener('click', function(event) {
  toggleProperties(!propertiesPanel.classList.contains('open'));
});

propertiesPanelResizer.addEventListener('dragstart', function(event) {
  const img = new Image();
  img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
  event.dataTransfer.setDragImage(img, 1, 1);

  startX = event.screenX;
  startWidth = propertiesPanel.getBoundingClientRect().width;
});

propertiesPanelResizer.addEventListener('drag', function(event) {

  if (!event.screenX) {
    return;
  }

  const delta = event.screenX - startX;

  const width = startWidth - delta;

  const open = width > 200;

  propertiesPanel.style.width = open ? `${width}px` : null;

  toggleProperties(open);
});

const remoteDiagram = url.searchParams.get('diagram');

if (remoteDiagram) {
  fetch(remoteDiagram).then(
    r => {
      if (r.ok) {
        return r.text();
      }

      throw new Error(`Status ${r.status}`);
    }
  ).then(
    text => openDiagram(text)
  ).catch(
    err => {
      showMessage('error', `Failed to open remote diagram: ${err.message}`);

      openDiagram(initialDiagram);
    }
  );
} else {
  openDiagram(initialDiagram);
}

toggleProperties(url.searchParams.has('pp'));

// expose for theming
window.bpmnjs = modeler;
