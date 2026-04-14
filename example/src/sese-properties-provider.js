import { TextFieldEntry, isTextFieldEntryEdited } from '@bpmn-io/properties-panel';
import { useService } from 'bpmn-js-properties-panel';

const LOW_PRIORITY = 500;

export default class SesePropertiesProvider {
    constructor(propertiesPanel) {
        propertiesPanel.registerProvider(LOW_PRIORITY, this);
    }

    getGroups(element) {
        return (groups) => {
            if (element.type === 'bpmn:Task') {
                groups.push(createDurationGroup(element));
            }
            return groups;
        };
    }
}

SesePropertiesProvider.$inject = ['propertiesPanel'];

function createDurationGroup(element) {
    return {
        id: 'sese-duration',
        label: 'Duration',
        entries: [
            {
                id: 'duration',
                component: DurationProps,
                isEdited: isTextFieldEntryEdited
            }
        ]
    };
}

function DurationProps(props) {
    const { element } = props;
    const modeling = useService('modeling');
    const debounce = useService('debounceInput');
    const bpmnFactory = useService('bpmnFactory');
    const translate = useService('translate');
    const commandStack = useService('commandStack');

    const getValue = () => {
        const businessObject = element.businessObject;
        const extensionElements = businessObject.extensionElements;
        if (!extensionElements) {
            return '';
        }
        const duration = extensionElements.values.find(e => e.$type === 'sese:Duration');
        return duration ? duration.min : '';
    };

    const setValue = (value) => {
        const businessObject = element.businessObject;
        let extensionElements = businessObject.extensionElements;

        // Convert value to float, handling empty string
        const floatValue = value === '' ? undefined : parseFloat(value);

        // If invalid number (NaN) but not empty, maybe keep as is or validation? 
        // For now simple float parsing.

        if (!extensionElements) {
            if (floatValue === undefined) return; // Don't create if empty
            extensionElements = bpmnFactory.create('bpmn:ExtensionElements');
            extensionElements.values = []; // Initialize values array
            modeling.updateProperties(element, { extensionElements });
        }

        let duration = extensionElements.values.find(e => e.$type === 'sese:Duration');

        if (!duration) {
            if (floatValue === undefined) return;
            duration = bpmnFactory.create('sese:Duration');
            duration.min = floatValue;
            duration.max = floatValue;

            // We need to update extensionElements.values
            // modeling.updateModdleProperties specific behavior might differ
            // Standard way is adding to list and updating

            // Using commandStack to execute cmd helper?
            // Or just push to values? Moddle elements are mutable but need command for undo.

            // modeling.updateModdleProperties(element, extensionElements, { values: ... })

            const newValues = [...extensionElements.values, duration];
            modeling.updateModdleProperties(element, extensionElements, { values: newValues });

        } else {
            if (floatValue === undefined) {
                // Remove duration?
                const newValues = extensionElements.values.filter(e => e !== duration);
                modeling.updateModdleProperties(element, extensionElements, { values: newValues });
            } else {
                modeling.updateModdleProperties(element, duration, {
                    min: floatValue,
                    max: floatValue
                });
            }
        }
    };

    return TextFieldEntry({
        element,
        id: 'duration',
        label: translate('Duration (min)'),
        getValue,
        setValue,
        debounce
    });
}
