/**
 * Rule: task-has-impact
 *
 * Reports a WARNING if a Task element does not have at least one <sese:impact> extension element.
 */
module.exports = function() {

  function check(node, reporter) {

    if (!isTask(node)) {
      return;
    }

    const extensionElements = node.extensionElements;

    if (!extensionElements || !extensionElements.values) {
      reporter.report(node.id, 'Task is missing impact');
      return;
    }

    const hasImpact = extensionElements.values.some(function(ext) {
      return ext.$type === 'sese:impact' ||
             (ext.$descriptor && ext.$descriptor.name === 'impact') ||
             (ext.localName === 'impact') ||
             (ext.$type && ext.$type.endsWith(':impact'));
    });

    if (!hasImpact) {
      reporter.report(node.id, 'Task is missing impact');
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
