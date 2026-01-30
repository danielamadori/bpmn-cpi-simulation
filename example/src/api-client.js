export async function executeStep(region, currentBackendState = null) {
    const url = 'http://localhost:8001/execute';

    // Construct payload
    // If we have a previous state, we use it to populate the context
    // otherwise we send just the region to start a new execution.

    let payload = {
        bpmn: region,
        petri_net: null,
        execution_tree: null,
        choices: null, // Must be null if petri_net is null
        preview: false
    };

    if (currentBackendState) {
        if (currentBackendState.execution_tree) {
            payload.execution_tree = currentBackendState.execution_tree;
        }
        if (currentBackendState.petri_net) {
            payload.petri_net = currentBackendState.petri_net;
        }

        // Auto-decision logic (Simulation Driver)
        // If the current snapshot offers choices, we need to pick one to proceed.
        // The backend logic: if 'choices' is passed in request, it consumes them.
        // If empty, it might stop?
        // Let's look at src/main.py:
        // ... "Consuming decisions: %s", decisions ... ctx.strategy.consume(...)

        // For now, let's try sending NO decisions and see if it advances (e.g. automatic transitions).
        // If the simulator is stuck on a choice, we need to pick one.

        const tree = currentBackendState.execution_tree;
        if (tree && tree.root) {
            // Find current node
            // Warning: The tree structure in JSON response is flattened or recursive?
            // Response schema says NodeModel.

            // We rely on the backend's "TimeStrategy" or default strategy to pick defaults?
            // No, 'CounterExecution' or 'TimeStrategy'.
            // Default is probably Counter.

            // If we want to "Step", we might need to tell it what to do.
            // But the playStates logic was: read Next state from JSON.
            // Here, the backend COMPUTES the next state.
            // So we just ask "Execute next step".
        }
    }

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const text = await response.text();
            throw new Error(`Backend Error ${response.status}: ${text}`);
        }

        return await response.json();
    } catch (err) {
        console.error('API Error:', err);
        throw err;
    }
}
