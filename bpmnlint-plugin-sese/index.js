/**
 * bpmnlint plugin: the two SESE rules the modeller enforces.
 *
 * THIS IS THE COPY THAT SHIPS. `Dockerfile.simulator` in the Simulator repo
 * does `FROM bpmn-cpi-simulation AS modeller` and then
 * `COPY --from=modeller /app /app`, and `run.sh` builds that base image from
 * this directory. So the plugin the modeller loads is this file, two submodule
 * levels below the parent project -- and a fix applied to either of the other
 * two copies never reaches a user.
 *
 * EACH RULE IS A PACKAGE-QUALIFIED PATH STRING, and every word of that is
 * forced by `bpmnlint/lib/support/compile-config.js`, which has to EMIT an
 * import statement at bundle time:
 *
 *   - line 142: `if (!isString(rule)) throw ... illegal rule export (expected
 *     path reference)`. A required module cannot be written back as an import,
 *     so the value must be a STRING. The modeller's webpack build failed with
 *     exactly that message;
 *   - line 185, `computeRuleImport`: a string starting with `.` is resolved
 *     through `resolver.require.resolve(`${pkg}/package.json`)`, and THIS
 *     PLUGIN HAS NO `package.json` -- measured 2026-10-18, it holds `index.js`
 *     and `rules/` and nothing else. So `'./rules/task-has-duration'` passes
 *     the check above and throws at the resolve. The `else` branch takes a
 *     non-dot reference as given.
 *
 * WHY `require(...)` SURVIVED FOR MONTHS: two resolution routes, and the React
 * GUI takes the other one. `compile-config` tries `$PKG.rules[$NAME]` first and
 * falls back to `$PKG/rules/$NAME` by convention. The GUI reaches the fallback
 * because its own copy sits under a package declaring `"type": "module"`, so
 * `module.exports` there is INERT -- `require` of it returns `{}`, and the
 * first route is skipped. Here the modeller is CommonJS, the first route is
 * taken, and the bundle fails.
 *
 * The error appeared exactly ONCE in the running container's entire log: in the
 * first boot taken after `node_modules/bpmnlint-plugin-sese` was symlinked to
 * it. The modeller still answered 200, because webpack-dev-server serves with a
 * failed module; what was lost is the linting of these two rules.
 */
module.exports = {
  rules: {
    'task-has-duration': 'bpmnlint-plugin-sese/rules/task-has-duration',
    'task-has-impact': 'bpmnlint-plugin-sese/rules/task-has-impact'
  }
};
