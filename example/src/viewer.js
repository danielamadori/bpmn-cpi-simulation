import TokenSimulationModule from '../../lib/viewer';

import BpmnViewer from 'bpmn-js/lib/NavigatedViewer';

import fileDrop from 'file-drops';

import fileOpen from 'file-open';

import exampleXML from '../resources/example.bpmn';
import minimapModule from 'diagram-js-minimap';

import gridModule from 'diagram-js-grid';
import download from 'downloadjs';
import { svgToPng } from './utils';


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

function hideMessage() {
  const dropMessage = document.querySelector('.drop-message');

  dropMessage.style.display = 'none';
}

function showMessage(cls, message) {
  const messageEl = document.querySelector('.drop-message');

  messageEl.textContent = message;
  messageEl.className = `drop-message ${cls || ''}`;

  messageEl.style.display = 'block';
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

const viewer = new BpmnViewer({
  container: '#canvas',
  additionalModules: [
    ExampleModule,
    TokenSimulationModule,
    gridModule,
    minimapModule
  ]
});

function sanitizeDiagram(viewerInstance, { persist = false } = {}) {
  const elementRegistry = viewerInstance.get('elementRegistry');
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
    viewerInstance.saveXML({ format: true }).then(({ xml }) => {
      localStorage['diagram-xml'] = xml;
    }).catch(() => {

      // non-fatal
    });
  }
}

function openDiagram(diagram) {
  return viewer.importXML(diagram)
    .then(({ warnings }) => {
      if (warnings.length) {
        console.warn(warnings);
      }

      sanitizeDiagram(viewer, { persist: persistent });

      if (persistent) {
        localStorage['diagram-xml'] = diagram;
      }

      viewer.get('canvas').zoom('fit-viewport');
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

function exportPNG() {
  viewer.saveSVG().then(({ svg }) => {
    svgToPng(svg).then(png => {
      download(png, fileName.replace(/\.bpmn$/i, '.png'), 'image/png');
    });
  });
}

function exportSVG() {
  viewer.saveSVG().then(({ svg }) => {
    download(svg, fileName.replace(/\.bpmn$/i, '.svg'), 'image/svg+xml');
  });
}

document.body.addEventListener('dragover', fileDrop('Open BPMN diagram', openFile), false);

document.querySelector('#export-png').addEventListener('click', function(event) {
  exportPNG();
});

document.querySelector('#export-svg').addEventListener('click', function(event) {
  exportSVG();
});

document.querySelector('#open-button').addEventListener('click', () => {
  fileOpen({
    extensions: [ '.bpmn' ],
    description: 'BPMN diagrams'
  }).then(openFile);
});

document.body.addEventListener('keydown', function(event) {
  if (event.code === 'KeyO' && (event.metaKey || event.ctrlKey)) {
    event.preventDefault();

    fileOpen().then(openFile);
  }
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

// expose for theming
window.bpmnjs = viewer;

