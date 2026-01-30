export function validateSESE(modeler) {
  const elementRegistry = modeler.get('elementRegistry');
  const canvas = modeler.get('canvas');
  const errors = [];

  // Find all scopes: Root Process(es) and SubProcesses
  // Note: Root elements might not be in elementRegistry.getAll() depending on implementation, 
  // but they are accessible via canvas.getRootElement().
  
  const scopes = [];
  
  // 1. Check Root Element
  const root = canvas.getRootElement();
  if (root.type === 'bpmn:Process') {
    scopes.push(root);
  } else if (root.type === 'bpmn:Collaboration') {
    // Collect Participants (Pools) which act as Processes
    if (root.children) {
      root.children.forEach(child => {
        if (child.type === 'bpmn:Participant') {
          scopes.push(child);
        }
      });
    }
  }

  // 2. Check Nested SubProcesses
  const allElements = elementRegistry.getAll();
  allElements.forEach(el => {
    if (el.type === 'bpmn:SubProcess') {
      scopes.push(el);
    }
  });

  // Validate each scope
  scopes.forEach(scope => {
    // Defensive check for children
    if (!scope.children) return;

    const starts = scope.children.filter(c => c.type === 'bpmn:StartEvent');
    const ends = scope.children.filter(c => c.type === 'bpmn:EndEvent');

    const name = (scope.businessObject && scope.businessObject.name) || scope.id;

    if (starts.length !== 1) {
      errors.push(`Scope '${name}' has ${starts.length} Start Events (must be 1).`);
    }
    if (ends.length !== 1) {
      errors.push(`Scope '${name}' has ${ends.length} End Events (must be 1).`);
    }
  });

  return {
    valid: errors.length === 0,
    errors: errors
  };
}
