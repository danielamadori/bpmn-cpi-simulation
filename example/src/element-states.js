/**
 * The ActivityState codes a snapshot gives each token, and how the statuses of
 * one element's tokens become the element's status.
 *
 * A module of its own so that a Karma spec can import it: importing
 * `modeler.js` builds the whole page.
 */

// ActivityState wire format (PACO convention): backend sends integer
// codes — no string transcription. The frontend uses the integers
// natively for all comparisons; the only translation happens at the
// CSS-class boundary (`state-status-<name>`), because CSS selectors
// require a textual identifier.
//
// Keep the constants in sync with the Simulator's
// ``src/parser/activity_state.py``.
export const STATE_UNKNOWN = -2;
export const STATE_SKIPPED = -1; // branch not taken; the states/ files' "will not be executed"
export const STATE_WAITING = 0;
export const STATE_ACTIVE = 1;
export const STATE_COMPLETED = 2;
export const STATE_COMPLETING = 3;
export const STATE_FAILING = 4;
export const STATE_FAILED = 5;
export const STATE_TERMINATING = 6;
export const STATE_TERMINATED = 7;

// Used only for ``normalizeStatusClass`` (CSS class derivation). A Map
// keeps native integer keys — object literal keys are coerced to strings
// (a misleading asymmetry between the negative sentinel and positive
// codes).
export const ACTIVITY_STATE_NAME = new Map([
  [ STATE_UNKNOWN, 'unknown' ],
  [ STATE_SKIPPED, 'will not be executed' ],
  [ STATE_WAITING, 'waiting' ],
  [ STATE_ACTIVE, 'active' ],
  [ STATE_COMPLETED, 'completed' ],
  [ STATE_COMPLETING, 'completing' ],
  [ STATE_FAILING, 'failing' ],
  [ STATE_FAILED, 'failed' ],
  [ STATE_TERMINATING, 'terminating' ],
  [ STATE_TERMINATED, 'terminated' ]
]);

/**
 * The status of an element whose tokens are NONE OF THE THREE the replay asks
 * about: no token ACTIVE, no token COMPLETED, and not all of them WAITING -- a
 * FAILED token, a SKIPPED one, WAITING beside TERMINATED, and so on.
 *
 * It is not an ActivityState code and it equals none of them, so every reader
 * of the aggregate (`diffCompletions`, `diffActivations`, the start-event
 * tests of `playStates` and `navigateForward`, `configureExclusiveGateways`),
 * which asks only «is it ACTIVE?», «is it COMPLETED?» or «is it WAITING?»,
 * answers no.
 */
export const NONE_OF_THE_THREE = 'none of: a token active, a token completed, all tokens waiting';

/**
 * The status of ONE element from the statuses of ALL its tokens.
 *
 * Daniel's decision of 2026-11-16, «Come il replay di BOS» -- BOS reads a
 * snapshot with sets (`computeSnapshotSets` in BOS's
 * `server/gui/src/BpmnSimulator.tsx`): an element is active when any of its
 * keys is active, completed when any is completed. Here, in this order:
 *
 *   1. ACTIVE    if ANY token is ACTIVE;
 *   2. COMPLETED if ANY token is COMPLETED;
 *   3. WAITING   only if ALL tokens are WAITING;
 *   4. NONE_OF_THE_THREE for every other mix.
 *
 * Each rule looks at the whole list, so the answer does not depend on the
 * order of the tokens -- which is the order of the keys in the snapshot. The
 * merge this replaces kept the FIRST key's status for every pair it did not
 * decide: WAITING then FAILED gave WAITING, FAILED then WAITING gave FAILED.
 *
 * @param {string} elementId the element the tokens are on, named in the error
 * @param {Array<number>} statuses one ActivityState code per token
 *
 * @return {number|string} an ActivityState code, or NONE_OF_THE_THREE
 */
export function aggregateTokenStatuses(elementId, statuses) {
  if (statuses.length === 0) {
    throw new Error(`Element "${elementId}" has no token status to aggregate`);
  }

  statuses.forEach(status => {
    if (!ACTIVITY_STATE_NAME.has(status)) {
      throw new Error(
        `Element "${elementId}" has a token whose status ${JSON.stringify(status)} ` +
        'is not one of the ten ActivityState codes (-2 to 7)'
      );
    }
  });

  if (statuses.includes(STATE_ACTIVE)) {
    return STATE_ACTIVE;
  }

  if (statuses.includes(STATE_COMPLETED)) {
    return STATE_COMPLETED;
  }

  if (statuses.every(status => status === STATE_WAITING)) {
    return STATE_WAITING;
  }

  return NONE_OF_THE_THREE;
}

/**
 * Group token statuses by element and aggregate each group with
 * `aggregateTokenStatuses`.
 *
 * @param {Array<[ string, number ]>} tokenStatuses `[ elementId, status ]`, one
 *   pair per token, in the order the snapshot lists its keys
 *
 * @return {Object<string, number|string>} elementId → aggregate status, the
 *   elements in the order of their first token
 */
export function aggregateStatusesByElement(tokenStatuses) {
  const statusesByElement = new Map();

  tokenStatuses.forEach(([ elementId, status ]) => {
    if (!statusesByElement.has(elementId)) {
      statusesByElement.set(elementId, []);
    }

    statusesByElement.get(elementId).push(status);
  });

  const result = {};

  statusesByElement.forEach((statuses, elementId) => {
    result[elementId] = aggregateTokenStatuses(elementId, statuses);
  });

  return result;
}
