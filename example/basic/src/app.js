import TokenSimulationModule from '../../../lib/viewer';

import BpmnViewer from 'bpmn-js/lib/NavigatedViewer';

import diagramXML from '../resources/diagram.bpmn';

const viewer = new BpmnViewer({
  container: '#canvas',
  additionalModules: [ TokenSimulationModule ]
});

viewer.importXML(diagramXML).then(({ warnings }) => {
  if (warnings && warnings.length) {
    console.log('import warnings', warnings);
  }

  viewer.get('canvas').zoom('fit-viewport');
}).catch(err => {
  console.error('failed to render diagram', err);
});
