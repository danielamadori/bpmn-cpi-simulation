export default function StartEventBehavior(
    simulator,
    activityBehavior) {

  this._simulator = simulator;
  this._activityBehavior = activityBehavior;

  simulator.registerBehavior('bpmn:StartEvent', this);
}

StartEventBehavior.prototype.signal = function(context) {
  const { element } = context;
  const continueEvent = this.waitAtElement(element);

  if (continueEvent) {
    return this._activityBehavior.signalOnEvent(context, continueEvent);
  }

  this._simulator.exit(context);
};

StartEventBehavior.prototype.enter = function(context) {
  const { element } = context;
  const continueEvent = this.waitAtElement(element);

  if (continueEvent) {
    return this._activityBehavior.signalOnEvent(context, continueEvent);
  }

  this._simulator.exit(context);
};

StartEventBehavior.prototype.waitAtElement = function(element) {
  const wait = this._simulator.getConfig(element).wait;

  return wait && {
    element,
    type: 'continue',
    interrupting: false,
    boundary: false
  };
};

StartEventBehavior.prototype.exit = function(context) {
  this._activityBehavior.exit(context);
};

StartEventBehavior.$inject = [
  'simulator',
  'activityBehavior'
];