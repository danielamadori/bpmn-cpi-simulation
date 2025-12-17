
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
    ['eventBus', 'bpmnjs', 'toggleMode', function (eventBus, bpmnjs, toggleMode) {

      if (persistent) {
        eventBus.on('commandStack.changed', function () {
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
    }]
  ]
};

const additionalModules = [
  BpmnPropertiesPanelModule,
  BpmnPropertiesProviderModule,
  TokenSimulationModule,
  AddExporter,
  ColorPickerModule,
  gridModule,
  SimulationSupportModule,
  ExampleModule,
  minimapModule,
  BpmnLintModule
];

const modeler = new BpmnModeler({
  container: '#canvas',
  additionalModules,
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

const simulationLog = () => modeler.get('log');

function logMessage(level, message) {
  const log = simulationLog();

  const consoleMethod = level === 'error' ? 'error' : level === 'warning' ? 'warn' : 'log';

  if (console[consoleMethod]) {
    console[consoleMethod](message);
  }

  if (log && typeof log.log === 'function') {
    log.log({
      text: message,
      type: level === 'error' ? 'error' : level === 'warning' ? 'warning' : 'info'
    });
  }
}

function logInfo(message) {
  logMessage('info', message);
}

function logWarning(message) {
  logMessage('warning', message);
}

function logError(message) {
  logMessage('error', message);
}

const lintingMessagesEl = document.querySelector('#linting-messages');

function sanitizeDiagram(modeler, { persist = false } = {}) {
  const elementRegistry = modeler.get('elementRegistry');
  const seenNames = new Map();

  function nextName(base) {
    let suffix = 2;
    let candidate = base;

    while (seenNames.has(candidate)) {
      candidate = `${base} (${suffix++})`;
    }

    seenNames.set(candidate, true);
    return candidate;
  }

  elementRegistry.getAll().forEach(element => {
    const bo = element.businessObject;

    // only normalize BPMN flow nodes (events, tasks, gateways, subprocesses, etc.)
    if (!bo || !bo.$instanceOf || !bo.$instanceOf('bpmn:FlowNode')) {
      return;
    }


    const rawName = bo.name && bo.name.trim();

    const baseName = rawName || `${(element.type || '').replace('bpmn:', '') || 'Element'} ${bo.id}`;
    const uniqueName = nextName(baseName);

    if (bo.name !== uniqueName) {
      bo.name = uniqueName;
    }
  });

  if (persist) {

    // keep sanitized XML in local storage so the next load stays valid
    modeler.saveXML({ format: true }).then(({ xml }) => {
      localStorage['diagram-xml'] = xml;
    }).catch(() => {

      // non-fatal if persistence fails
    });
  }
}

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

      sanitizeDiagram(modeler, { persist: persistent });

      if (persistent) {
        localStorage['diagram-xml'] = diagram;
      }

      modeler.get('canvas').zoom('fit-viewport');

      // Auto-start simulation at t0
      initializeSimulationToStart();
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

document.body.addEventListener('keydown', function (event) {
  if (event.code === 'KeyS' && (event.metaKey || event.ctrlKey)) {
    event.preventDefault();

    downloadDiagram();
  }

  if (event.code === 'KeyO' && (event.metaKey || event.ctrlKey)) {
    event.preventDefault();

    fileOpen().then(openFile);
  }
});

document.querySelector('#download-button').addEventListener('click', function (event) {
  downloadDiagram();
});

document.querySelector('#export-png').addEventListener('click', function (event) {
  exportPNG();
});

document.querySelector('#export-svg').addEventListener('click', function (event) {
  exportSVG();
});

document.querySelector('#open-button').addEventListener('click', () => {
  fileOpen({
    extensions: ['.bpmn'],
    description: 'BPMN diagrams'
  }).then(openFile);
});

// move simulation UI controls (toggle + animation speed) into a dedicated left gutter stack
function moveSimulationControls() {
  console.log('Moving simulation controls to groups');

  const controlGroup = document.getElementById('control-group');
  const monitorGroup = document.getElementById('monitor-group');
  const ioGroup = document.getElementById('io-group');

  // Move token simulation toggle to control group
  const toggleMode = document.querySelector('.bts-toggle-mode');
  if (toggleMode && controlGroup && toggleMode.parentNode !== controlGroup) {
    controlGroup.appendChild(toggleMode);
  }

  // Move token simulation palette to control group
  const paletteEntries = document.querySelector('.bts-palette');
  if (paletteEntries && controlGroup && paletteEntries.parentNode !== controlGroup) {
    controlGroup.appendChild(paletteEntries);
  }

  // Move animation speed control to I/O group (under theme toggle)
  const speedControl = document.querySelector('.bts-set-animation-speed');
  if (speedControl && ioGroup && speedControl.parentNode !== ioGroup) {
    ioGroup.appendChild(speedControl);
  }

  // Move linting messages to monitor group
  const lintingMessages = document.getElementById('linting-messages');
  if (lintingMessages && monitorGroup && lintingMessages.parentNode !== monitorGroup) {
    monitorGroup.appendChild(lintingMessages);
  }

  // Move simulation log to monitor group
  const log = document.querySelector('.bts-log');
  if (log && monitorGroup && log.parentNode !== monitorGroup) {
    monitorGroup.appendChild(log);
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
// webpack injects require.context; lint as a known global.
// eslint-disable-next-line no-undef
const statesContext = require.context('../../states', false, /\.json$/);
const stateSequence = statesContext.keys().sort((a, b) => {
  const getNumber = (str) => {
    const match = str.match(/t(\d+)\.json$/);
    return match ? parseInt(match[1], 10) : 0;
  };
  return getNumber(a) - getNumber(b);
}).map(key => ({
  name: key.replace('./', '').replace('.json', ''),
  state: statesContext(key)
}));

let executionOrderMap = null;

function getExecutionOrderMap() {
  if (executionOrderMap) {
    return executionOrderMap;
  }

  const executionOrder = [];
  const seenTasks = new Set();
  const registry = elementRegistry();

  stateSequence.forEach(snapshot => {
    Object.keys(snapshot.state).forEach(taskId => {

      if (!registry.get(taskId)) {
        throw new Error(`Element '${taskId}' in snapshot '${snapshot.name}' not found in the BPMN model.`);
      }

      if (!seenTasks.has(taskId)) {
        executionOrder.push(taskId);
        seenTasks.add(taskId);
      }
    });
  });

  executionOrderMap = new Map(executionOrder.map((id, index) => [id, index]));
  return executionOrderMap;
}

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
    statePanelTitle.textContent = `State: ${snapshot.name} (Step Mode)`;
  }

  console.log(`[${new Date().toLocaleTimeString()}] Loading State JSON: ${snapshot.name}`, snapshot.state);

  statePanelBody.innerHTML = '';

  const orderMap = getExecutionOrderMap();
  const entries = Object.entries(snapshot.state).sort(([a], [b]) => {
    const orderA = orderMap.has(a) ? orderMap.get(a) : Infinity;
    const orderB = orderMap.has(b) ? orderMap.get(b) : Infinity;
    return orderA - orderB;
  });

  if (!entries.length) {
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = 2;
    cell.className = 'state-panel-empty';
    cell.textContent = 'No activities in this snapshot';
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

function diffActivations(prev, next) {
  return Object.keys(next).filter(id => prev[id] !== 'active' && next[id] === 'active');
}

function getSortedTriggers(ids) {
  const registry = elementRegistry();
  return ids.sort((a, b) => {
    const elA = registry.get(a);
    const elB = registry.get(b);
    return (elA ? elA.x : 0) - (elB ? elB.x : 0);
  });
}

async function waitForTokenDrain(simulationSupport, ids) {
  const sortedIds = getSortedTriggers(ids);
  console.log('Triggering in order:', sortedIds);

  for (const id of sortedIds) {
    let attempts = 0;
    const maxAttempts = 15;

    while (attempts < maxAttempts) {
      try {
        const simulator = modeler.get('simulator');
        const element = elementRegistry().get(id);

        // Check if we are waiting at this element (e.g. paused Gateway)
        // If so, we need to SIGNAL the scope, not trigger the element again
        const waitingScope = simulator.findScopes({
          element: element
        }).find(scope => scope.children.length === 0 && !scope.destroyed);
        // Note: Waiting scopes usually have no children and are suspended.

        if (waitingScope) {
          console.log(`Found waiting scope for ${id}, signaling...`);
          simulator.signal({
            scope: waitingScope,
            element: element,
            initiator: element // Passing initiator can be important
          });
        } else {
          // Standard trigger for fresh activation or resume provided by simulationSupport
          simulationSupport.triggerElement(id);
        }

        console.log(`Triggered ${id} successfully.`);
        break; // Exit retry loop on success
      } catch (err) {
        console.warn(`Attempt ${attempts + 1} to trigger ${id} failed: ${err.message}. Waiting...`);
        attempts++;
        if (attempts >= maxAttempts) {
          console.error(`Failed to trigger ${id} after ${maxAttempts} attempts. Moving on.`);

          // Optional: throw or alert final failure, or just continue to next element
          // For now we continue, assuming user might click manually if needed.
        } else {

          // Wait for animation/token arrival
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      }
    }

    // Standard visual pacing delay after successful/failed trigger
    await new Promise(resolve => setTimeout(resolve, 300));
  }
}

let currentStateIndex = 0;
let isStepping = false;

// Helper to lock exclusive gateways if their path is determined by the next state
// Helper to lock exclusive gateways if their path is determined by the next state
function configureExclusiveGateways(startIndex) {
  const simulator = modeler.get('simulator');
  const registry = elementRegistry();

  // Get all exclusive gateways
  const gateways = registry.getAll().filter(el => el.type === 'bpmn:ExclusiveGateway');

  gateways.forEach(gateway => {

    // Look ahead to find the transition where this gateway consumes its token
    let targetFlow = null;

    // We start searching from the transition leading TO startIndex
    // But we are interested in when the gateway LEAVES (Active -> Inactive)
    for (let i = startIndex; i < stateSequence.length; i++) {
      const prev = i > 0 ? stateSequence[i - 1].state : {};
      const next = stateSequence[i].state;

      // Check if gateway fires in this transition (prev has it, next doesn't)
      const wasActive = prev[gateway.id] === 'active';
      const isActive = next[gateway.id] === 'active';

      if (wasActive && !isActive) {

        // Find which outgoing flow matches the activated element
        const activations = diffActivations(prev, next);

        // Find the child that connects to this gateway
        const activeChildId = activations.find(childId => {
          const child = registry.get(childId);
          return child && child.incoming.some(flow => flow.source === gateway);
        });

        if (activeChildId) {
          const child = registry.get(activeChildId);
          targetFlow = child.incoming.find(flow => flow.source === gateway);
        }

        // We found the transition point, stop searching
        break;
      }
    }

    if (targetFlow) {
      simulator.setConfig(gateway, {
        locked: true,
        activeOutgoing: targetFlow,
        wait: true
      });
    } else {
      // If no future transition found for this gateway, unlock it
      // BUT: Only strictly unlock if we scanned the whole future and found nothing.
      // If the gateway is not even active in the sequence, we unlock it (default behavior).
      simulator.setConfig(gateway, { locked: false, wait: false });
    }
  });
}

function initializeSimulationToStart() {
  logInfo('DEBUG: NEW VERSION LOADED (Manual Mode). If you see this message, the code is up to date.');
  if (!stateSequence.length) return;

  const simulationSupport = modeler.get('simulationSupport');

  // Ensure token simulation is active
  simulationSupport.toggleSimulation(true);

  // Reset sequence to t0
  currentStateIndex = 0;

  // FORCE PAUSE ON ALL ELEMENTS
  // This ensures the token stops at Gateways, SubProcesses, etc.
  const elementRegistry = modeler.get('elementRegistry');
  const simulator = modeler.get('simulator');

  elementRegistry.getAll().forEach(element => {

    // Force pause on all elements EXCEPT EndEvents (they auto-consume) and Processes
    if (element.type !== 'bpmn:Process' && element.type !== 'bpmn:EndEvent') {
      simulator.setConfig(element, { wait: true });
    }
  });

  // Render t0 only. Do NOT trigger Start Event yet.
  // This ensures we start in a "waiting" state (t0).
  // The first click on "Play" will trigger the Start Event (t0 -> t1).
  console.log('Initializing to t0 (Pre-start)...');
  try {
    renderStateSnapshot(stateSequence[0]);
    configureExclusiveGateways(1);
  } catch (e) {
    console.warn('Could not render t0:', e);
  }
}

async function playStates() {
  console.log('PLAY STATE SEQUENCE CLICKED (Manual Mode)');

  if (isStepping) {
    console.warn('Simulation step already in progress...');
    return;
  }

  isStepping = true;
  playStatesBtn.disabled = true;

  try {
    const simulationSupport = modeler.get('simulationSupport');
    const registry = elementRegistry();

    // Ensure simulation is on
    simulationSupport.toggleSimulation(true);

    if (!stateSequence.length) {
      console.warn('No state snapshots found in /states');
      showStatePanelMessage('No snapshots found in /states');
      return;
    }

    // We are at currentStateIndex. We want to go to currentStateIndex + 1.
    const nextIndex = currentStateIndex + 1;

    if (nextIndex < stateSequence.length) {
      const nextSnapshot = stateSequence[nextIndex];
      console.log(`Advancing from ${currentStateIndex} to ${nextIndex}: ${nextSnapshot.name}`);

      logInfo(`STEP ${currentStateIndex} -> ${nextIndex}: ${nextSnapshot.name} - transition in progress.`);

      if (currentStateIndex === 0) {

        // ... t0 -> t1
        console.log('Triggering Start Event to transition t0 -> t1');
        simulationSupport.triggerElement('StartEvent_0offpno');
      } else {

        // Normal Case: tN -> tN+1
        const prev = stateSequence[currentStateIndex].state;
        const next = nextSnapshot.state;

        const completions = diffCompletions(prev, next);

        // Detect SubProcesses becoming active (entering) OR Catch Events becoming active (pulling from Gateway)
        const activations = diffActivations(prev, next).filter(id => {
          const el = registry.get(id);
          return el && (el.type === 'bpmn:SubProcess' || el.type === 'bpmn:Transaction' || el.type === 'bpmn:IntermediateCatchEvent');
        });

        const allActions = [...activations, ...completions].filter(id => {

          // Do NOT try to trigger EndEvents, they don't support it.
          const el = registry.get(id);

          // Also skip EventBasedGateway triggering if we are triggering the Event instead.
          // Actually, triggering the Gateway usually does nothing. Let's leave it filtered out OR just let it fail silently.
          // Best to skip triggering the Gateway itself if it's EventBased.
          return el && el.type !== 'bpmn:EndEvent' && el.type !== 'bpmn:EventBasedGateway';
        });

        if (allActions.length) {


          await waitForTokenDrain(simulationSupport, allActions);
        }
      }

      // Update UI to show we are now at nextSnapshot
      renderStateSnapshot(nextSnapshot);
      currentStateIndex = nextIndex;

      configureExclusiveGateways(nextIndex + 1);
    } else {
      console.log('State sequence completed');
      showStatePanelMessage('State sequence completed.');
    }
  } catch (err) {
    console.error('State playback failed', err);
    logError('Error while playing the step: ' + err.message);
  } finally {

    // ALWAYS re-enable the button
    isStepping = false;
    playStatesBtn.disabled = false;
  }
}

playStatesBtn.onclick = () => {
  playStates();
};

modeler.get('eventBus').on('tokenSimulation.resetSimulation', () => {

  // Restart from t0 (no tokens)
  initializeSimulationToStart();
});


// Properties panel is now always visible in the left sidebar

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

// expose for theming
window.bpmnjs = modeler;
