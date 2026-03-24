export default function IntermediateThrowEventBehavior(
    simulator,
    activityBehavior,
    scopeBehavior) {

  this._simulator = simulator;
  this._activityBehavior = activityBehavior;

  simulator.registerBehavior('bpmn:IntermediateThrowEvent', this);
  simulator.registerBehavior('bpmn:SendTask', this);
}

IntermediateThrowEventBehavior.prototype.enter = function(context) {
  const {
    element
  } = context;

  const eventBehaviors = this._simulator.injector.get('eventBehaviors');
  const eventBehavior = eventBehaviors.get(element);

  if (eventBehavior) {
    const event = eventBehavior(context);

    if (event) {
      return this._activityBehavior.signalOnEvent(context, event);
    }
  }

  this._activityBehavior.enter(context);
};

IntermediateThrowEventBehavior.prototype.signal = function(context) {
  this._activityBehavior.signal(context);
};

IntermediateThrowEventBehavior.prototype.exit = function(context) {
  this._activityBehavior.exit(context);
};

IntermediateThrowEventBehavior.$inject = [
  'simulator',
  'activityBehavior',
  'scopeBehavior'
];