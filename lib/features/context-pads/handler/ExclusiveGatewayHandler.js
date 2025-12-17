import {
  is
} from 'bpmn-js/lib/util/ModelUtil';

import {
  ForkIcon
} from '../../../icons';


export default function ExclusiveGatewayHandler(exclusiveGatewaySettings, simulator) {
  this._exclusiveGatewaySettings = exclusiveGatewaySettings;
  this._simulator = simulator;
}

ExclusiveGatewayHandler.prototype.createContextPads = function (element) {

  const config = this._simulator.getConfig(element);
  const isLocked = config && config.locked;

  const outgoingFlows = element.outgoing.filter(function (outgoing) {
    return is(outgoing, 'bpmn:SequenceFlow');
  });

  if (outgoingFlows.length < 2) {
    return;
  }

  const title = isLocked ? 'Sequence Flow Locked (Automatic)' : 'Set Sequence Flow';
  const style = 'margin-top: 35px; ' + (isLocked ? 'opacity: 0.5; cursor: not-allowed;' : '');

  const html = `
    <div class="bts-context-pad" title="${title}" style="${style}">
      ${ForkIcon()}
    </div>
  `;

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
      html
    }
  ];
};

ExclusiveGatewayHandler.$inject = [
  'exclusiveGatewaySettings',
  'simulator'
];