import {
  SELECTION_CHANGED_EVENT
} from '../../util/EventHelper';

/**
 * API for managing and monitoring element selection in the BPMN diagram.
 * This module provides methods to get selected elements and listen to selection changes,
 * similar to how the properties panel works.
 */
export default function SelectionAPI(eventBus, selection, elementRegistry) {
  this._eventBus = eventBus;
  this._selection = selection;
  this._elementRegistry = elementRegistry;
  this._listeners = [];

  // Listen to selection changes from diagram-js
  eventBus.on('selection.changed', event => {
    this._handleSelectionChanged(event);
  });
}

/**
 * Internal handler for selection changes
 */
SelectionAPI.prototype._handleSelectionChanged = function(event) {
  const { newSelection, oldSelection } = event;

  // Fire custom event with enriched data
  this._eventBus.fire(SELECTION_CHANGED_EVENT, {
    elements: newSelection || [],
    previousElements: oldSelection || [],
    hasSelection: newSelection && newSelection.length > 0
  });

  // Call registered listeners
  this._listeners.forEach(listener => {
    try {
      listener(newSelection || [], oldSelection || []);
    } catch (error) {

      // ignore listener errors to avoid breaking diagram interactions
    }
  });
};

/**
 * Get currently selected elements
 *
 * @returns {Array<Object>} Array of selected BPMN elements
 *
 * @example
 * const selected = selectionAPI.getSelectedElements();
 * if (selected.length > 0) {
 *   console.log('Selected element IDs:', selected.map(e => e.id));
 * }
 */
SelectionAPI.prototype.getSelectedElements = function() {
  return this._selection.get() || [];
};

/**
 * Get a single selected element (if only one is selected)
 *
 * @returns {Object|null} The selected element or null if none or multiple selected
 *
 * @example
 * const element = selectionAPI.getSelectedElement();
 * if (element) {
 *   console.log('Selected:', element.id, element.type);
 * }
 */
SelectionAPI.prototype.getSelectedElement = function() {
  const selected = this.getSelectedElements();
  return selected.length === 1 ? selected[0] : null;
};

/**
 * Check if an element is currently selected
 *
 * @param {Object|String} elementOrId - Element object or element ID
 * @returns {Boolean} True if the element is selected
 *
 * @example
 * if (selectionAPI.isSelected('Task_1')) {
 *   console.log('Task_1 is selected');
 * }
 */
SelectionAPI.prototype.isSelected = function(elementOrId) {
  const id = typeof elementOrId === 'string' ? elementOrId : elementOrId.id;
  const selected = this.getSelectedElements();
  return selected.some(element => element.id === id);
};

/**
 * Register a listener for selection changes
 *
 * @param {Function} callback - Function to call when selection changes.
 *                              Receives (newSelection, oldSelection) as parameters
 * @returns {Function} Unsubscribe function to remove the listener
 *
 * @example
 * const unsubscribe = selectionAPI.onSelectionChanged((newSelection, oldSelection) => {
 *   console.log('New selection:', newSelection.map(e => e.id));
 *   console.log('Previous selection:', oldSelection.map(e => e.id));
 * });
 *
 * // Later, to stop listening:
 * unsubscribe();
 */
SelectionAPI.prototype.onSelectionChanged = function(callback) {
  if (typeof callback !== 'function') {
    throw new Error('Callback must be a function');
  }

  this._listeners.push(callback);

  // Return unsubscribe function
  return () => {
    const index = this._listeners.indexOf(callback);
    if (index > -1) {
      this._listeners.splice(index, 1);
    }
  };
};

/**
 * Subscribe to selection changes.
 * Alias for {@link SelectionAPI#onSelectionChanged}.
 *
 * @param {Function} callback
 * @returns {Function} Unsubscribe function
 */
SelectionAPI.prototype.subscribe = function(callback) {
  return this.onSelectionChanged(callback);
};

/**
 * Get information about the currently selected element(s)
 * Returns enriched information similar to what the properties panel would show
 *
 * @returns {Object} Selection information object
 *
 * @example
 * const info = selectionAPI.getSelectionInfo();
 * console.log(info);
 * // {
 * //   count: 1,
 * //   elements: [...],
 * //   types: ['bpmn:Task'],
 * //   ids: ['Task_1']
 * // }
 */
SelectionAPI.prototype.getSelectionInfo = function() {
  const elements = this.getSelectedElements();

  return {
    count: elements.length,
    elements: elements,
    types: elements.map(e => e.type),
    ids: elements.map(e => e.id),
    businessObjects: elements.map(e => e.businessObject)
  };
};

/**
 * Select element(s) programmatically
 *
 * @param {Object|Array<Object>|String|Array<String>} elementsOrIds - Element(s) or ID(s) to select
 *
 * @example
 * // Select single element by ID
 * selectionAPI.select('Task_1');
 *
 * // Select multiple elements by ID
 * selectionAPI.select(['Task_1', 'Task_2']);
 *
 * // Select element object
 * const element = elementRegistry.get('Task_1');
 * selectionAPI.select(element);
 */
SelectionAPI.prototype.select = function(elementsOrIds) {
  let elements = elementsOrIds;

  // Convert to array if single element
  if (!Array.isArray(elements)) {
    elements = [ elements ];
  }

  // Convert IDs to element objects
  elements = elements.map(item => {
    if (typeof item === 'string') {
      return this._elementRegistry.get(item);
    }
    return item;
  }).filter(e => e); // Remove null/undefined

  this._selection.select(elements);
};

/**
 * Clear the current selection
 *
 * @example
 * selectionAPI.clearSelection();
 */
SelectionAPI.prototype.clearSelection = function() {
  this._selection.select([]);
};

SelectionAPI.$inject = [ 'eventBus', 'selection', 'elementRegistry' ];
