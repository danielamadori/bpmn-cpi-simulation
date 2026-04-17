/**
 * Rule: task-has-duration
 *
 * Reports an ERROR if a Task element does not have a <sese:duration> extension element.
 */
module.exports = function() {

  function check(node, reporter) {

    if (!isTask(node)) {
      return;
    }

    const extensionElements = node.extensionElements;

    if (!extensionElements || !extensionElements.values) {
      reporter.report(node.id, 'Task is missing min/max duration');
      return;
    }

    const hasDuration = extensionElements.values.some(function(ext) {
      return ext.$type === 'sese:duration' ||
             (ext.$descriptor && ext.$descriptor.name === 'duration') ||
             (ext.localName === 'duration') ||
             (ext.$type && ext.$type.endsWith(':duration'));
    });

    if (!hasDuration) {
      reporter.report(node.id, 'Task is missing min/max duration');
    }
  }

  return { check: check };
};

function isTask(node) {
  var type = node.$type;
  return type === 'bpmn:Task' ||
         type === 'bpmn:UserTask' ||
         type === 'bpmn:ServiceTask' ||
         type === 'bpmn:SendTask' ||
         type === 'bpmn:ReceiveTask' ||
         type === 'bpmn:ManualTask' ||
         type === 'bpmn:BusinessRuleTask' ||
         type === 'bpmn:ScriptTask';
}
