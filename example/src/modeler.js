
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

let fileName = 'example.bpmn';

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

// --- Token ID helpers ---

/**
 * Parse a canonical state key ``registryId@contextId.filename#tokenId``
 * into its components.
 */
function parseStateKey(key) {
  const hashIdx = key.indexOf('#');
  let tokenId = null;
  let keyWithoutToken = key;
  if (hashIdx >= 0) {
    tokenId = key.substring(hashIdx + 1);
    keyWithoutToken = key.substring(0, hashIdx);
  }
  const [registryId, contextId] = keyWithoutToken.split('@');
  return { registryId, contextId: contextId || null, tokenId };
}

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
    try {
      log.log({
        text: message,
        type: level === 'error' ? 'error' : level === 'warning' ? 'warning' : 'info'
      });
    } catch (e) {
      console.warn('Could not output to UI log:', e.message);
    }
  }
}

function logInfo(message) {
  logMessage('info', message);
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
    if (element.labelTarget) {
      return;
    }

    const bo = element.businessObject;

    // only normalize BPMN flow nodes (events, tasks, gateways, subprocesses, etc.)
    if (!bo || !bo.$instanceOf || !bo.$instanceOf('bpmn:FlowNode')) {
      return;
    }


    const rawName = (bo.name || '').trim();

    // Clean existing (N) suffixes to prevent accumulation like (2) (2)
    const baseName = (rawName || `${(element.type || '').replace('bpmn:', '') || 'Element'} ${bo.id}`)
      .replace(/\s\(\d+\)$/, '');

    const uniqueName = nextName(baseName);

    if (bo.name !== uniqueName) {
      console.log(`[Sanitize] Renaming ${bo.id}: "${bo.name}" -> "${uniqueName}"`);
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

      // Force ALL tasks to behave as wait states so tokens stay visible on them
      const registry = modeler.get('elementRegistry');
      const simulator = modeler.get('simulator');
      registry.getAll().forEach(el => {
        if (el.type === 'bpmn:Task' || el.type === 'bpmn:UserTask' || el.type === 'bpmn:ServiceTask') {
          simulator.waitAtElement(el, true);
        }
      });

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

const elementTokenHistory = new Map();
let messageLogs = []; // Global state for intercepted messages
let currentDiagramName = ''; // Dynamically mapped when loading a diagram

// Mapping processId → tok_N, built from stateSequence keys.
// Mirrors ExecutionTree.allocate_token_id() which assigns tok_0, tok_1, ...
// one per process in XML document order.
const processToTokenMap = new Map();

function buildProcessToTokenMap() {
  processToTokenMap.clear();
  for (const entry of stateSequence) {
    for (const key of Object.keys(entry.state || {})) {
      const { tokenId } = parseStateKey(key);
      if (!tokenId) continue;
      // Extract processId from context: "Task@Process_1.filename#tok_0"
      // contextId = "Process_1.filename", processId = walk up to bpmn:Process
      // But we can get processId directly from the key's context.
      // Context format: "Process_1.filename" or "SubProc.Process_1.filename"
      const { contextId } = parseStateKey(key);
      if (!contextId) continue;
      // Process is the second-to-last segment: "Process_1" from "Process_1.filename"
      // or the root process from "SubProc.Process_1.filename"
      const parts = contextId.split('.');
      if (parts.length < 2) continue;
      const processId = parts[parts.length - 2]; // e.g. "Process_1"
      // Root token = tok_N (first 2 parts of tokenId)
      const rootToken = tokenId.split('_').slice(0, 2).join('_');
      if (!processToTokenMap.has(processId)) {
        processToTokenMap.set(processId, rootToken);
      }
    }
    if (processToTokenMap.size > 0) break; // First snapshot with tokens is enough
  }
}

// Resolve a bpmn-js scope ID to our tok_N for a given element.
function resolveTokenId(element, scopeId) {
  if (processToTokenMap.size === 0) return scopeId;
  const processId = getProcessId(element);
  return processToTokenMap.get(processId) || scopeId;
}

function renderMessageLogs() {
  const panel = document.getElementById('message-panel');
  if (panel) panel.classList.add('visible');

  const tbody = document.getElementById('message-panel-body');
  if (!tbody) return;

  tbody.innerHTML = '';
  if (messageLogs.length === 0) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td class="state-panel-empty" colspan="4" style="text-align: center; border: 1px solid #ccc; padding: 5px;">Nessun messaggio tracciato</td>`;
    tbody.appendChild(tr);
    return;
  }

  messageLogs.forEach(msg => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="border: 1px solid #ccc; padding: 5px; font-size: 0.9em; word-break: break-all;">${msg.source}</td>
      <td style="border: 1px solid #ccc; padding: 5px; font-size: 0.9em; word-break: break-all;">${msg.destination}</td>
      <td style="border: 1px solid #ccc; padding: 5px;">${msg.id}</td>
      <td style="border: 1px solid #ccc; padding: 5px;">${msg.payload}</td>
    `;
    tbody.appendChild(tr);
  });
}

// Helpers for extracting correct semantic scope and processes
function getProcessId(el) {
  if (!el || !el.businessObject) return 'UnknownProcess';
  let bo = el.businessObject;
  while (bo && bo.$type !== 'bpmn:Process') {
     bo = bo.$parent;
  }
  return bo ? bo.id : 'UnknownProcess';
}

function getLatestScopeId(elementId) {
  if (elementTokenHistory.has(elementId)) {
    const history = elementTokenHistory.get(elementId);
    if (history.size > 0) {
      return [...history.keys()].pop();
    }
  }
  return 'unknown';
}

modeler.get('eventBus').on('tokenSimulation.simulator.trace', event => {
  const { action, element, scope: elementScope } = event;
  if (!element || !elementScope) return;
  
  if (action === 'enter' || action === 'signal') {
    const elementId = element.id || element;
    if (!elementTokenHistory.has(elementId)) {
      elementTokenHistory.set(elementId, new Map());
    }
    const tokenScope = elementScope.parent || elementScope;
    const tokenId = resolveTokenId(element, tokenScope.id);
    elementTokenHistory.get(elementId).set(tokenId, 'active');
  }

  if (action === 'exit') {
    const elementId = element.id || element;
    if (elementTokenHistory.has(elementId)) {
       const tokenScope = elementScope.parent || elementScope;
       const tokenId = resolveTokenId(element, tokenScope.id);
       elementTokenHistory.get(elementId).set(tokenId, 'completed');
    }

    if (element.type === 'bpmn:MessageFlow') {
      const sourceElement = element.source;
      const targetElement = element.target;

      const sourceProcessName = getProcessId(sourceElement);
      const targetProcessName = getProcessId(targetElement);

      const diagramId = currentDiagramName;

      const sourceTokenId = processToTokenMap.get(sourceProcessName) || getLatestScopeId(sourceElement.id);
      const targetTokenId = processToTokenMap.get(targetProcessName) || getLatestScopeId(targetElement.id);

      const sourceStr = `${sourceElement.id}@${sourceProcessName}.${diagramId}#${sourceTokenId}`;
      const destStr = `${targetElement.id}@${targetProcessName}.${diagramId}#${targetTokenId}`;

      const bo = element.businessObject;
      const baseMessageId = bo.messageRef ? bo.messageRef.id : element.id;
      const messageId = `${baseMessageId}#${sourceTokenId}:#${targetTokenId}`;
      const messageName = bo.messageRef && bo.messageRef.name ? bo.messageRef.name : element.id;
      const payloadStr = `contenuto base messaggio ${messageName}`;

      messageLogs.push({
        source: sourceStr,
        destination: destStr,
        id: messageId,
        payload: payloadStr
      });

      renderMessageLogs();
    }
  }
});

// --- state sequence playback (drives tokens from JSON snapshots) ---

const playStatesBtn = document.getElementById('play-state-sequence');
const statePanel = document.getElementById('state-panel');
const statePanelTitle = document.getElementById('state-panel-title');
const statePanelBody = document.getElementById('state-panel-body');
const elementRegistry = () => modeler.get('elementRegistry');

// load all JSON state snapshots from /states in lexicographic order
// webpack injects require.context; lint as a known global.
// eslint-disable-next-line no-undef
const statesContext = require.context('../../states', true, /\.json$/);

let stateSequence = [];
let executionOrderMap = null;

function loadStateSequenceForCurrentDiagram() {
  const baseName = fileName.replace(/\.bpmn$/i, '');
  const allKeys = statesContext.keys();
  console.log('[StateLoader] fileName:', fileName, 'baseName:', baseName);
  currentDiagramName = baseName; // Update global baseName for message mapping
  console.log('[StateLoader] All context keys:', allKeys);
  // Filter keys for this specific diagram's subdirectory
  const diagramKeys = allKeys.filter(k => k.startsWith(`./${baseName}/`));
  console.log('[StateLoader] Matched keys for', baseName, ':', diagramKeys);

  stateSequence = diagramKeys.sort((a, b) => {
    const getNumber = (str) => {
      const match = str.match(/t(\d+)\.json$/);
      return match ? parseInt(match[1], 10) : 0;
    };
    return getNumber(a) - getNumber(b);
  }).map(key => ({
    name: key.replace(`./${baseName}/`, '').replace('.json', ''),
    state: statesContext(key)
  }));
  console.log('[StateLoader] Loaded', stateSequence.length, 'snapshots for', baseName);
  buildProcessToTokenMap();

  executionOrderMap = null;
}

function getExecutionOrderMap() {
  if (executionOrderMap) {
    return executionOrderMap;
  }

  const executionOrder = [];
  const seenTasks = new Set();
  const registry = elementRegistry();

  stateSequence.forEach(snapshot => {
    Object.keys(snapshot.state).forEach(taskId => {
      const { registryId } = parseStateKey(taskId);
      if (!registry.get(registryId)) {
        console.warn(`Element '${registryId}' in snapshot '${snapshot.name}' not found in the BPMN model. Skipping.`);
        return;
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

  // Group entries by element (without #token_id) — one row per element.
  const elementEntries = new Map(); // "registryId@contextId" → Map(tokenId → status)
  const elementOrder = [];          // preserve execution order
  entries.forEach(([taskId, status]) => {
    const { registryId, contextId, tokenId } = parseStateKey(taskId);
    const elementKey = contextId ? `${registryId}@${contextId}` : registryId;
    if (!elementEntries.has(elementKey)) {
      elementEntries.set(elementKey, new Map());
      elementOrder.push(elementKey);
    }
    if (!tokenId) {
      throw new Error(`State key "${taskId}" is missing #token_id fragment`);
    }
    elementEntries.get(elementKey).set(tokenId, status);
  });

  elementOrder.forEach(elementKey => {
    const tokenMap = elementEntries.get(elementKey);
    const row = document.createElement('tr');
    const taskCell = document.createElement('td');
    const statusCell = document.createElement('td');

    const { registryId, contextId } = parseStateKey(elementKey);
    const element = elementRegistry().get(registryId);
    let displayName = element && element.businessObject && element.businessObject.name
      ? element.businessObject.name
      : registryId;

    if (contextId) {
      displayName += `@${contextId}`;
    }

    taskCell.textContent = displayName;

    if (tokenMap.size > 1) {
      // Multiple tokens on this element — show each token_id with status
      statusCell.style.whiteSpace = "pre-wrap";
      statusCell.innerHTML = '';
      for (const [tokenId, tokenStatus] of tokenMap.entries()) {
        const div = document.createElement('div');
        div.textContent = `${tokenId}: "${tokenStatus}"`;
        div.classList.add(normalizeStatusClass(tokenStatus));
        statusCell.appendChild(div);
      }
    } else {
      // Single token — show token_id: "status"
      const [tokenId, tokenStatus] = [...tokenMap.entries()][0];
      statusCell.textContent = `${tokenId}: "${tokenStatus}"`;
      statusCell.classList.add(normalizeStatusClass(tokenStatus));
    }

    row.appendChild(taskCell);
    row.appendChild(statusCell);
    statePanelBody.appendChild(row);
  });
}

// --- Replay to target index ---
// Uses the SAME logic as playStates() but without isStepping guard / UI button.
// Replays step-by-step from t0 to targetIndex using the existing
// diffCompletions/diffActivations/waitForTokenDrain mechanism.
let _replayInProgress = false;

async function replayToIndex(targetIndex) {
  if (_replayInProgress) {
    console.log('[replay] Already in progress, skipping');
    return;
  }
  _replayInProgress = true;
  const simulationSupport = modeler.get('simulationSupport');
  const simulator = modeler.get('simulator');
  const registry = modeler.get('elementRegistry');

  // Ensure simulation mode is active
  simulationSupport.toggleSimulation(true);

  // Full reset — destroys old scopes and reinitializes root scopes.
  simulator.reset();

  const clampedTarget = Math.min(targetIndex, stateSequence.length - 1);

  if (!stateSequence.length || targetIndex < 1) {
    if (stateSequence.length) renderStateSnapshot(stateSequence[0]);
    return;
  }

  // Configure wait based on TARGET snapshot:
  // - completed elements → wait:false (token flows through)
  // - active elements → wait:true (token stops here)
  // - waiting elements → wait:true (token stops if it arrives)
  const targetState = stateSequence[clampedTarget] ? stateSequence[clampedTarget].state : {};
  const completedInTarget = new Set();
  Object.entries(targetState).forEach(([key, status]) => {
    const { registryId } = parseStateKey(key);
    if (status === 'completed') completedInTarget.add(registryId);
  });

  const waitConfig = {};
  registry.getAll().forEach(el => {
    if (el.type === 'bpmn:Process' || el.type === 'bpmn:Participant') return;
    let shouldWait = !completedInTarget.has(el.id);
    // Join gateways (incoming > 1) are not in the target state map —
    // they must always let tokens through (wait:false).
    const isJoin = (el.type === 'bpmn:ExclusiveGateway' || el.type === 'bpmn:ParallelGateway')
      && el.incoming && el.incoming.filter(f => f.type === 'bpmn:SequenceFlow').length > 1;
    if (isJoin) shouldWait = false;
    simulator.setConfig(el, { wait: shouldWait });
    waitConfig[el.id] = shouldWait;
  });
  console.log('[replay] wait:false on:', Object.keys(waitConfig).filter(k => !waitConfig[k]).join(', '));

  // Render t0
  currentStateIndex = 0;
  renderStateSnapshot(stateSequence[0]);

  // Lock exclusive gateways, select the correct branch, and color flows.
  // Uses the same elementColors/simulationStyles API as ExclusiveGatewaySettings.
  const elementColors = modeler.get('elementColors');
  const simulationStyles = modeler.get('simulationStyles');

  const gateways = registry.getAll().filter(el => el.type === 'bpmn:ExclusiveGateway');
  gateways.forEach(gateway => {
    const outgoing = (gateway.outgoing || []).filter(f => f.type === 'bpmn:SequenceFlow');
    if (outgoing.length < 2) return;

    if (!completedInTarget.has(gateway.id)) return;

    const selectedFlow = outgoing.find(flow =>
      flow.target && completedInTarget.has(flow.target.id)
    );

    if (selectedFlow) {
      simulator.setConfig(gateway, { locked: true, activeOutgoing: selectedFlow, wait: false });

      // Color: selected branch dark, non-selected light grey
      outgoing.forEach(flow => {
        const style = flow === selectedFlow
          ? '--token-simulation-grey-darken-30'
          : '--token-simulation-grey-lighten-56';
        elementColors.add(flow, 'exclusive-gateway-settings', {
          stroke: simulationStyles.get(style)
        }, 2000);
      });
    } else {
      simulator.setConfig(gateway, { locked: false, wait: false });
    }
  });

  // Trigger all StartEvents ONCE. Tokens flow through wait:false (completed)
  // elements and stop on wait:true (active/waiting) elements automatically.
  const t1 = stateSequence[1] ? stateSequence[1].state : {};
  // Deduplicate start events by registryId (multiple #token_id keys
  // for the same element should trigger it only once).
  const startEventRegistryIds = new Set();
  Object.keys(t1).forEach(id => {
    const { registryId } = parseStateKey(id);
    const el = registry.get(registryId);
    if (el && el.type === 'bpmn:StartEvent') {
      startEventRegistryIds.add(registryId);
    }
  });

  console.log('[replay] Triggering StartEvents:', [...startEventRegistryIds]);
  for (const seId of startEventRegistryIds) {
    try {
      simulationSupport.triggerElement(seId);
    } catch (err) {
      console.warn('[replay] triggerElement failed for', seId, err.message);
    }
  }

  // Wait for tokens to settle
  await new Promise(r => setTimeout(r, 500));

  // Update state panel to show target
  currentStateIndex = clampedTarget;
  renderStateSnapshot(stateSequence[clampedTarget]);

  // Force token count refresh — the simulator may not emit elementChanged
  // for all elements during async replay. Fire tick to update overlays.
  await new Promise(r => setTimeout(r, 100));
  registry.getAll().forEach(el => {
    modeler.get('eventBus').fire('tokenSimulation.simulator.elementChanged', { element: el });
  });

  console.log('[replay] Complete at index', currentStateIndex);

  _replayInProgress = false;
}

function getOverallStatus(status) {
  if (typeof status === 'string') return status;
  if (typeof status === 'object' && status !== null) {
    const values = Object.values(status);
    if (values.includes('active')) return 'active';
    if (values.every(v => v === 'completed')) return 'completed';
    if (values.includes('waiting')) return 'waiting';
    return 'unknown';
  }
  return status;
}

/**
 * Aggregate state by registryId — combines all #token_id keys for the
 * same element into a single overall status.
 */
function aggregateByElement(state) {
  const result = {};  // registryId → overall status
  for (const [key, status] of Object.entries(state)) {
    const { registryId } = parseStateKey(key);
    const prev = result[registryId];
    if (!prev) {
      result[registryId] = status;
    } else {
      // active > completed > waiting (keep the most "progressed" status)
      if (status === 'active' || prev === 'active') result[registryId] = 'active';
      else if (status === 'completed' && prev !== 'active') result[registryId] = 'completed';
    }
  }
  return result;
}

function diffCompletions(prev, next) {
  const prevAgg = aggregateByElement(prev);
  const nextAgg = aggregateByElement(next);
  return Object.keys(nextAgg).filter(id => prevAgg[id] === 'active' && nextAgg[id] === 'completed');
}

function diffActivations(prev, next) {
  const prevAgg = aggregateByElement(prev);
  const nextAgg = aggregateByElement(next);
  return Object.keys(nextAgg).filter(id => prevAgg[id] !== 'active' && nextAgg[id] === 'active');
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
    let triggered = false;
    let attempts = 0;
    const maxAttempts = 3;

    while (!triggered && attempts < maxAttempts) {
      try {
        const simulator = modeler.get('simulator');
        const element = elementRegistry().get(id);

        if (!element) {
          throw new Error('Element not found in registry');
        }

        const waitingScope = simulator.findScopes({
          element: element
        }).find(scope => scope.children.length === 0 && !scope.destroyed);

        if (waitingScope) {
          console.log(`Found waiting scope for ${id}, signaling...`);
          simulator.signal({
            scope: waitingScope,
            element: element,
            initiator: element
          });
        } else {
          simulationSupport.triggerElement(id);
        }

        console.log(`Triggered ${id} successfully.`);
        triggered = true;
      } catch (err) {
        console.warn(`Attempt ${attempts + 1} to trigger ${id} failed: ${err.message}.`);
        attempts++;
        if (attempts >= maxAttempts) {
          console.error(`Failed to trigger ${id} after ${maxAttempts} attempts. Moving on.`);
        } else {

          // Fallback minimal safe wait before retry if API is genuinely not ready
          await new Promise(r => requestAnimationFrame(r));
        }
      }
    }
  }

  // Wait deterministically for ALL triggers' cascading simulator events and animations to drain
  await drainSimulationQueues();
}

async function drainSimulationQueues() {

  // The simulator processes all jobs synchronously inside queue(),
  // so by the time triggerElement/signal returns, simulator jobs are already done.
  // The only async work is token animations along sequence flows.
  const animation = modeler.get('animation', false);

  if (!animation || !animation._animations) return;

  return new Promise(resolve => {
    const MAX_WAIT = 10000;
    const start = Date.now();

    function checkDrain() {
      const pendingAnimations = animation._animations.size;

      if (pendingAnimations > 0 && (Date.now() - start) < MAX_WAIT) {
        requestAnimationFrame(checkDrain);
      } else {
        resolve();
      }
    }

    // Give animation engine at least 1 frame to start
    requestAnimationFrame(checkDrain);
  });
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
      const prevAggGw = aggregateByElement(prev);
      const nextAggGw = aggregateByElement(next);

      const wasActive = prevAggGw[gateway.id] === 'active';
      const isActive = nextAggGw[gateway.id] === 'active';

      if (wasActive && !isActive) {

        // Find which outgoing flow matches the activated element
        const activations = diffActivations(prev, next);

        // Find the child that connects to this gateway
        // (diffActivations returns registryIds directly)
        const activeChildId = activations.find(registryId => {
          const child = registry.get(registryId);
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

let _statesInjectedViaApi = false;
let _pendingApiStates = null;
let _pendingApiTargetIndex = null;

function initializeSimulationToStart() {
  logInfo('DEBUG: NEW VERSION LOADED (Manual Mode). If you see this message, the code is up to date.');

  // Check for deferred API states (arrived before diagram was ready)
  if (_pendingApiStates) {
    const registry = modeler.get('elementRegistry');
    const firstKey = Object.keys(_pendingApiStates.length ? _pendingApiStates[0].state : {})[0];
    const testId = firstKey ? parseStateKey(firstKey).registryId : null;
    if (testId && registry.get(testId)) {
      stateSequence = _pendingApiStates;
      _statesInjectedViaApi = true;
      _pendingApiStates = null;
      buildProcessToTokenMap();
      console.log('[init] Applied pending API states');
    } else {
      console.log('[init] Pending states do not match current diagram, deferring');
    }
  }

  if (!_statesInjectedViaApi) {
    const remoteDiagramParam = new URL(window.location.href).searchParams.get('diagram');
    if (remoteDiagramParam) {
      console.log('[init] Remote diagram mode — skipping file-based states, waiting for postMessage');
      stateSequence = [];
    } else {
      loadStateSequenceForCurrentDiagram();
    }
  }

  if (!stateSequence.length) {
    showStatePanelMessage('No state snapshots found for ' + fileName);
    return;
  }

  const simulationSupport = modeler.get('simulationSupport');
  simulationSupport.toggleSimulation(true);

  // Reset sequence to t0
  currentStateIndex = 0;

  // FORCE PAUSE ON ALL ELEMENTS
  const elementRegistry = modeler.get('elementRegistry');
  const simulator = modeler.get('simulator');

  elementTokenHistory.clear();
  messageLogs = [];
  renderMessageLogs();

  elementRegistry.getAll().forEach(element => {

    // Force pause on all elements EXCEPT:
    // - Process/Participant: container scopes
    // - EndEvent: auto-consume
    // - StartEvent: wait:true blocks forever (signalOnEvent subscribes
    //   to 'continue' but nothing triggers it)
    if (element.type === 'bpmn:Process' || element.type === 'bpmn:Participant'
        || element.type === 'bpmn:EndEvent' || element.type === 'bpmn:StartEvent') {
      return;
    }
    simulator.setConfig(element, { wait: true });
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

  // If API states were deferred, replay to target
  if (_statesInjectedViaApi && _pendingApiTargetIndex !== null) {
    const target = _pendingApiTargetIndex;
    _pendingApiTargetIndex = null;
    replayToIndex(target);
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
        // Find the StartEvent that transitions from waiting -> completed in t0 -> t1
        const prev = stateSequence[0].state;
        const next = nextSnapshot.state;
        const prevAgg = aggregateByElement(prev);
        const nextAgg = aggregateByElement(next);
        const startEventIds = Object.keys(nextAgg).filter(id => {
          const el = registry.get(id);
          return el && el.type === 'bpmn:StartEvent' && prevAgg[id] === 'waiting' && nextAgg[id] === 'completed';
        });
        console.log('[PlayStates] Detected root start events from JSON:', startEventIds);
        if (startEventIds.length > 0) {
          startEventIds.forEach(id => simulationSupport.triggerElement(id));
          await drainSimulationQueues();
          // DEBUG: check scopes after trigger
          const simDbg = modeler.get('simulator');
          const allScopes = simDbg.findScopes({});
          console.log('[DEBUG] Scopes after trigger:', allScopes.length, allScopes.map(s => `${s.element.id}:${s.id}:destroyed=${s.destroyed}:children=${s.children.length}`));
        } else {
          console.warn('No matching StartEvent found in state snapshots for t0 -> t1');
        }
      } else {

        // Normal Case: tN -> tN+1
        const prev = stateSequence[currentStateIndex].state;
        const next = nextSnapshot.state;

        // Detect StartEvents that fire in this step (waiting -> completed)
        // This handles processes that start later in the sequence (e.g. Sender starts after Receiver)
        // Exclude Message Start Events — they are triggered automatically via MessageFlow
        const prevAggN = aggregateByElement(prev);
        const nextAggN = aggregateByElement(next);
        const lateStartIds = Object.keys(nextAggN).filter(id => {
          const el = registry.get(id);
          if (!el || el.type !== 'bpmn:StartEvent') return false;
          if (prevAggN[id] !== 'waiting' || nextAggN[id] !== 'completed') return false;
          // Skip Message Start Events (they have a messageEventDefinition)
          const bo = el.businessObject;
          const hasMessageDef = bo && bo.eventDefinitions && bo.eventDefinitions.some(d => d.$type === 'bpmn:MessageEventDefinition');
          if (hasMessageDef) return false;
          return true;
        });

        if (lateStartIds.length > 0) {
          console.log('[PlayStates] Detected late-starting processes:', lateStartIds);
          lateStartIds.forEach(id => simulationSupport.triggerElement(id));
          await drainSimulationQueues();
        }

        // diffCompletions/diffActivations now return registryIds directly
        const completions = diffCompletions(prev, next);

        // Detect SubProcesses becoming active (entering) OR Catch Events becoming active
        const activations = diffActivations(prev, next).filter(id => {
          const el = registry.get(id);
          return el && (el.type === 'bpmn:SubProcess' || el.type === 'bpmn:Transaction' || el.type === 'bpmn:IntermediateCatchEvent');
        });

        const allActions = [...activations, ...completions].filter(id => {
          const el = registry.get(id);

          // Do NOT try to trigger EndEvents, they don't support it.
          if (!el || el.type === 'bpmn:EndEvent' || el.type === 'bpmn:EventBasedGateway') return false;

          // Skip IntermediateCatchEvents with signal/message definitions —
          // they are unblocked automatically by the corresponding throw event
          if (el.type === 'bpmn:IntermediateCatchEvent') {
            const bo = el.businessObject;
            const hasAutoTrigger = bo && bo.eventDefinitions && bo.eventDefinitions.some(d =>
              d.$type === 'bpmn:SignalEventDefinition' || d.$type === 'bpmn:MessageEventDefinition'
            );
            if (hasAutoTrigger) return false;
          }

          return true;
        });

        if (allActions.length) {
          // allActions are already registryIds from the diff functions
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

// --- postMessage API for external state injection ---
// Parent frame (combined.html) sends {type: 'loadStates', states: [...]}
// when user selects a node in the execution tree. We reset the simulation
// and replay step by step using the SAME playStates() mechanism.
window.addEventListener('message', async (event) => {
  const data = event.data;
  if (!data || typeof data !== 'object') return;

  if (data.type === 'loadStates') {
    if (_replayInProgress) {
      console.log('[postMessage] Replay in progress, ignoring');
      return;
    }
    const states = Array.isArray(data.states) ? data.states : [];
    const targetIndex = parseInt(data.targetIndex, 10) || (states.length - 1);
    console.log('[postMessage] Received', states.length, 'states, target index', targetIndex);

    // Check if the current diagram matches these states
    const firstKey = Object.keys(states.length ? states[0].state : {})[0];
    const testId = firstKey ? parseStateKey(firstKey).registryId : null;
    const registry = modeler.get('elementRegistry');
    const diagramMatches = testId && registry.get(testId);

    if (!diagramMatches) {
      // BPMN not loaded yet — save for deferred application
      _pendingApiStates = states;
      _pendingApiTargetIndex = targetIndex;
      console.log('[postMessage] Diagram not ready, deferring');
      return;
    }

    // Inject states and replay to target
    stateSequence = states;
    executionOrderMap = null;
    buildProcessToTokenMap();
    _statesInjectedViaApi = true;

    await replayToIndex(targetIndex);
  }
});
