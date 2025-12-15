export { default as SelectionAPI } from './SelectionAPI';

import SelectionAPIModule from './SelectionAPI';

export default {
  __init__: [ 'selectionAPI' ],
  selectionAPI: [ 'type', SelectionAPIModule ]
};
