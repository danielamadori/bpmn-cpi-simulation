
// Helper to get element type simplified
function getType(element) {
    if (element.type === 'bpmn:Task' || element.type === 'bpmn:UserTask' || element.type === 'bpmn:ServiceTask' || element.type === 'bpmn:ManualTask' || element.type === 'bpmn:SendTask' || element.type === 'bpmn:ReceiveTask' || element.type === 'bpmn:ScriptTask' || element.type === 'bpmn:BusinessRuleTask') {
        return 'task';
    }
    if (element.type === 'bpmn:ExclusiveGateway') return 'exclusive';
    if (element.type === 'bpmn:ParallelGateway') return 'parallel';
    if (element.type === 'bpmn:StartEvent') return 'start';
    if (element.type === 'bpmn:EndEvent') return 'end';
    if (element.type === 'bpmn:SubProcess') return 'subprocess';
    return 'unknown';
}

export function parseBPMN(modeler) {
    const elementRegistry = modeler.get('elementRegistry');
    const canvas = modeler.get('canvas');
    const root = canvas.getRootElement();

    // ID Mapping (String -> Int)
    let idCounter = 1;
    const idMap = new Map();

    function getIntId(bpmnId) {
        if (!idMap.has(bpmnId)) {
            idMap.set(bpmnId, idCounter++);
        }
        return idMap.get(bpmnId);
    }

    // Find Start Event
    const startEvents = elementRegistry.filter(e => e.parent === root && e.type === 'bpmn:StartEvent');
    if (startEvents.length !== 1) {
        throw new Error('Diagram must have exactly one Start Event (SESE constraint).');
    }

    // Recursive parser
    function parseSequence(currentElement, stopAtElement = null) {
        const sequenceItems = [];
        let current = currentElement;

        while (current && current !== stopAtElement) {
            if (current.type === 'bpmn:EndEvent') {
                break;
            }

            const type = getType(current);

            if (type === 'task' || type === 'subprocess') {
                sequenceItems.push({
                    id: getIntId(current.id),
                    type: 'task',
                    label: current.businessObject.name || current.id,
                    duration: 1,
                    impacts: [1], // REQUIRED: Must not be empty, must be list of floats/ints
                });
                current = getNext(current);

            } else if (type === 'start') {
                current = getNext(current);

            } else if (type === 'exclusive' || type === 'parallel') {
                // Split
                if (current.outgoing.length > 1) {
                    const splitNode = current;
                    const gatewayType = type === 'exclusive' ? 'choice' : 'parallel';

                    const joinNode = findGenericJoin(splitNode);
                    if (!joinNode) throw new Error(`Closing Join not found for ${splitNode.id}`);

                    const children = [];
                    splitNode.outgoing.forEach((flow, index) => {
                        console.log(`[Parser] Gateway ${splitNode.id} Branch ${index} -> ${flow.target.id} (${flow.target.businessObject.name})`);
                        const branchResult = parseSequence(flow.target, joinNode);
                        // Convert branch items (List) to Binary Sequence (Single Node)
                        children.push(listToBinarySequence(branchResult.items));
                    });

                    const node = {
                        id: getIntId(splitNode.id),
                        type: gatewayType,
                        label: splitNode.businessObject.name || gatewayType,
                        children: children
                    };

                    // Validators specific reqs
                    if (gatewayType === 'choice') {
                        node.max_delay = 0; // REQUIRED
                    }

                    sequenceItems.push(node);
                    current = joinNode;
                    current = getNext(current);

                } else {
                    // 1-1 Gateway (Passthrough/Join)
                    current = getNext(current);
                }
            } else {
                // Unknown/Skipped
                current = getNext(current);
            }
        }

        return { items: sequenceItems, next: null };
    }

    // Helper to convert list [A, B, C, D] -> Sequential(A, Sequential(B, Sequential(C, D)))
    function listToBinarySequence(items) {
        if (items.length === 0) {
            // Empty branch? Impossible in well-formed, but theoretically:
            // Simulate empty task? Or null?
            // Return a dummy task "No Op"
            return {
                id: idCounter++,
                type: 'task',
                label: 'NoOp',
                duration: 0,
                impacts: [0]
            };
        }
        if (items.length === 1) {
            return items[0];
        }

        // Binary splits
        // [A, B, C] -> { type: seq, children: [A, { type: seq, children: [B, C] } ] }
        const first = items[0];
        const rest = items.slice(1);

        return {
            id: idCounter++, // Synthetic ID for Sequence Node
            type: 'sequential',
            children: [first, listToBinarySequence(rest)]
        };
    }

    function getNext(element) {
        if (!element.outgoing || element.outgoing.length === 0) return null;
        return element.outgoing[0].target;
    }

    function findGenericJoin(splitNode) {
        const branches = splitNode.outgoing.map(f => f.target);
        const reachables = branches.map(b => getAllReachable(b));
        if (reachables.length === 0) return null;
        let intersection = reachables[0];
        for (let i = 1; i < reachables.length; i++) {
            intersection = new Set([...intersection].filter(x => reachables[i].has(x)));
        }
        const candidates = [...intersection].filter(node =>
            (node.type === 'bpmn:ExclusiveGateway' || node.type === 'bpmn:ParallelGateway')
        );
        return candidates[0];
    }

    function getAllReachable(startNode) {
        const set = new Set();
        const stack = [startNode];
        while (stack.length > 0) {
            const n = stack.pop();
            if (set.has(n)) continue;
            set.add(n);
            if (n.outgoing) {
                n.outgoing.forEach(f => stack.push(f.target));
            }
        }
        return set;
    }

    try {
        const result = parseSequence(startEvents[0]);
        // Return binary tree of the main sequence
        const root = listToBinarySequence(result.items);

        // Create reverse map for the consumer
        const reverseMap = {};
        for (const [key, value] of idMap.entries()) {
            reverseMap[value] = key;
        }

        return { region: root, idMap: reverseMap };

    } catch (e) {
        console.error("Parsing failed", e);
        throw e;
    }
}
