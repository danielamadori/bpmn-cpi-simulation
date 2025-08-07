const CopyWebpackPlugin = require('copy-webpack-plugin');
const { DefinePlugin } = require('webpack');


module.exports = (env, argv) => {

  const mode = argv.mode || 'development';

  const devtool = mode === 'development' ? 'eval-source-map' : 'source-map';

  return {
    mode,
    entry: {
      viewer: './example/src/viewer.js',
      modeler: './example/src/modeler.js',
      basic: './example/basic/src/app.js'
    },
    output: {
      filename: 'dist/[name].js',
      path: __dirname + '/example'
    },
    module: {
      rules: [
        {
          test: /\.bpmn$/,
          type: 'asset/source'
        }
      ]
    },
    plugins: [
      new CopyWebpackPlugin({
        patterns: [
          { from: './assets', to: 'dist/vendor/bpmn-js-token-simulation/assets' },
          { from: 'bpmn-js/dist/assets', context: 'node_modules', to: 'dist/vendor/bpmn-js/assets' },
          { from: '@bpmn-io/properties-panel/dist/assets', context: 'node_modules', to: 'dist/vendor/bpmn-js-properties-panel/assets' },
          { from: 'bpmn-js-bpmnlint/dist/assets', context: 'node_modules', to: 'dist/vendor/bpmn-js-bpmnlint/assets' },
          { from: 'bpmn-js-color-picker/colors/color-picker.css', context: 'node_modules', to: 'dist/vendor/bpmn-js-color-picker/colors/color-picker.css' },
          { from: 'diagram-js-minimap/assets/diagram-js-minimap.css', context: 'node_modules', to: 'dist/vendor/diagram-js-minimap/assets/diagram-js-minimap.css' }
        ]
      }),
      new DefinePlugin({
        'process.env.TOKEN_SIMULATION_VERSION': JSON.stringify(require('./package.json').version)
      })
    ],
    devtool
  };

};