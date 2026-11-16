import {
  is
} from 'bpmn-js/lib/util/ModelUtil';

import {
  ForkIcon
} from '../../../icons';


export default function ExclusiveGatewayHandler(exclusiveGatewaySettings, simulator, translate) {
  this._exclusiveGatewaySettings = exclusiveGatewaySettings;
  this._simulator = simulator;
  this._translate = translate;
}

ExclusiveGatewayHandler.prototype.createContextPads = function(element) {

  const config = this._simulator.getConfig(element);
  const isLocked = config && config.locked;

  const outgoingFlows = element.outgoing.filter(function(outgoing) {
    return is(outgoing, 'bpmn:SequenceFlow');
  });

  if (outgoingFlows.length < 2) {
    return;
  }

  const style = 'margin-top: 35px; ' + (isLocked ? 'opacity: 0.5; cursor: not-allowed;' : '');

  const html = `
    <button class="bts-context-pad" style="${style}">
      ${ForkIcon()}
    </button>
  `;

  const title = this._translate(isLocked ? 'Sequence Flow Locked (Automatic)' : 'Set Sequence Flow');

  const action = () => {
    if (isLocked) {
      return;
    }
    this._exclusiveGatewaySettings.setSequenceFlow(element);
  };

  return [
    {
      action,
      element,
      html,
      title
    }
  ];
};

ExclusiveGatewayHandler.$inject = [
  'exclusiveGatewaySettings',
  'simulator',
  'translate'
];