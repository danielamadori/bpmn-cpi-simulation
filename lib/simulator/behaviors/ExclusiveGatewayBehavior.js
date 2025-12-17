import {
  filterSequenceFlows
} from '../util/ModelUtil';


export default function ExclusiveGatewayBehavior(simulator, scopeBehavior) {
  this._scopeBehavior = scopeBehavior;
  this._simulator = simulator;

  simulator.registerBehavior('bpmn:ExclusiveGateway', this);
}

ExclusiveGatewayBehavior.prototype.signal = function (context) {
  this._simulator.exit(context);
};

ExclusiveGatewayBehavior.prototype.enter = function (context) {
  const {
    element
  } = context;

  const continueEvent = this.waitAtElement(element);

  if (continueEvent) {
    return this.signalOnEvent(context, continueEvent);
  }

  this._simulator.exit(context);
};

ExclusiveGatewayBehavior.prototype.waitAtElement = function (element) {
  const wait = this._simulator.getConfig(element).wait;

  return wait && {
    element,
    type: 'continue',
    interrupting: false,
    boundary: false
  };
};

ExclusiveGatewayBehavior.prototype.signalOnEvent = function (context, event) {
  const {
    scope,
    element
  } = context;

  const subscription = this._simulator.subscribe(scope, event, initiator => {
    subscription.remove();

    return this._simulator.signal({
      scope,
      element,
      initiator
    });
  });
};

ExclusiveGatewayBehavior.prototype.exit = function (context) {

  const {
    element,
    scope
  } = context;

  // depends on UI to properly configure activeOutgoing for
  // each exclusive gateway

  const outgoings = filterSequenceFlows(element.outgoing);

  if (outgoings.length === 1) {
    return this._simulator.enter({
      element: outgoings[0],
      scope: scope.parent
    });
  }

  const {
    activeOutgoing
  } = this._simulator.getConfig(element);

  const outgoing = outgoings.find(o => o === activeOutgoing);

  if (!outgoing) {
    return this._scopeBehavior.tryExit(scope.parent, scope);
  }

  return this._simulator.enter({
    element: outgoing,
    scope: scope.parent
  });
};

ExclusiveGatewayBehavior.$inject = [
  'simulator',
  'scopeBehavior'
];