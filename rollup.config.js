import { string } from 'rollup-plugin-string';
import commonjs from '@rollup/plugin-commonjs';
import { nodeResolve } from '@rollup/plugin-node-resolve';

export default {
  input: 'src/icons/index.js',
  output: {
    file: 'lib/icons/index.js',
    format: 'esm',
    sourcemap: true
  },
  plugins: [
    string({
      include: '**/*.svg'
    }),
    nodeResolve({ browser: true }),
    commonjs()
  ]
};