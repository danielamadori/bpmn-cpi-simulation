import { isAny } from '../util/ModelUtil';


export default function EventBasedGatewayBehavior(simulator) {
  this._simulator = simulator;

  simulator.registerBehavior('bpmn:EventBasedGateway', this);
}

EventBasedGatewayBehavior.$inject = [
  'simulator'
];

EventBasedGatewayBehavior.prototype.enter = function(context) {

  const {
    element,
    scope
  } = context;

  const parentScope = scope.parent;

  const triggerElements = getTriggers(element);

  // create subscriptions for outgoing event triggers
  // do nothing else beyond that
  const subscriptions = triggerElements.map(
    triggerElement => this._simulator.subscribe(parentScope, triggerElement, initiator => {

      // cancel all subscriptions
      subscriptions.forEach(subscription => subscription.remove());

      // destroy this scope
      this._simulator.destroyScope(scope, initiator);

      // An event configured to wait (the modeller's state-sequence replay
      // sets wait on every element) RECEIVES the token and holds it, as a
      // catch event reached by a sequence flow does; the next trigger
      // releases it. Signalling it instead fires and leaves it in one
      // move, so no state can show the token ON the event: a snapshot
      // saying "the event-based gateway is completed and its timer event
      // is active" (states/example t10) had nothing to draw.
      if (this._simulator.getConfig(triggerElement).wait) {
        return this._simulator.enter({
          element: triggerElement,
          scope: parentScope,
          initiator
        });
      }

      // signal triggered event
      return this._simulator.signal({
        element: triggerElement,
        parentScope,
        initiator
      });
    })
  );

};


// helpers ////////////////

function getTriggers(element) {
  return element.outgoing.map(
    outgoing => outgoing.target
  ).filter(activity => isAny(activity, [
    'bpmn:IntermediateCatchEvent',
    'bpmn:ReceiveTask'
  ]));
}