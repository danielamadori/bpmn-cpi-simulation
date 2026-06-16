export async function executeStep(bpmnXML, currentBackendState = null, timeStep = null, processIndex = null) {
    // The API base MUST be injected by the host page as ``window._apiBaseUrl``
    // (the combined report sets it per deployment). No fallback: a missing base
    // is a wiring error and is raised, not silently defaulted to some port.
    if (typeof window === 'undefined' || !window._apiBaseUrl) {
        throw new Error('window._apiBaseUrl is not set — the host page must inject the API base URL');
    }
    const url = String(window._apiBaseUrl).replace(/\/+$/, '') + '/v1/execution-tree';

    // Construct payload
    // If we have a previous state, we use it to populate the context,
    // otherwise we send just the region to start a new execution.

    let payload = {
        payload: bpmnXML,
        input_format: 'bpmn',
        include_visualizations: false
    };

    if (processIndex !== null) {
        payload.process_index = processIndex;
    }

    if (currentBackendState && currentBackendState.snapshot) {
        payload.snapshot = currentBackendState.snapshot;
    }

    if (timeStep !== null) {
        payload.delta_t = parseFloat(timeStep);
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
