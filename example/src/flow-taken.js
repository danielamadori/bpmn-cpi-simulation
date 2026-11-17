/**
 * Which outgoing flow an exclusive gateway took in one step of a snapshot
 * sequence, as «Play state sequence» reads it (flowTakenBy, used by
 * configureExclusiveGateways in ./modeler.js), and which one a replay of a
 * host's path sends it down (flowTowardsTargetState, used by
 * _replayFromStart and navigateForward).
 *
 * A module of its own so that a Karma spec can import it: importing
 * `modeler.js` builds the whole page.
 *
 * WHY IT LOOKS PAST THE NEXT ELEMENT. Until 2026-11-17 the flow was found
 * only by the element right after the gateway, and only when that element
 * became active in the step. A decision whose ways begin with a gateway could
 * not be steered by any snapshot: in new_example/two_tasks_one_pool_in_a_loop
 * Gw_check goes back over Gw_entry and Gw_split to T_A and T_B, and leaves
 * over Gw_after to End_R. None of them holds a token, and End_R never becomes
 * active. So the gateway was left unlocked, and upstream's settings sent the
 * token down its first flow on every lap.
 */

import {
  STATE_ACTIVE,
  STATE_COMPLETED
} from './element-states';

/**
 * The gateways a token passes without being held, so a way through them still
 * leads from the decision to what the step moved. An event-based gateway
 * waits for its events and an inclusive gateway forks by its own
 * configuration, so neither is one.
 */
const PASSING_GATEWAYS = new Set([ 'bpmn:ExclusiveGateway', 'bpmn:ParallelGateway' ]);

function sequenceFlows(flows) {
  return flows.filter(flow => flow.type === 'bpmn:SequenceFlow');
}

/**
 * Whether the step `prevAgg -> nextAgg` moved `id`: it became active, or it
 * became completed. An element no key of the second snapshot names did not
 * move. One the first snapshot does not name was in no state there (the
 * Simulator names a process's elements only once the process exists), so it
 * was neither active nor completed.
 */
function movedBy(prevAgg, nextAgg, id) {
  if (!(id in nextAgg)) {
    return false;
  }

  const wasActive = id in prevAgg && prevAgg[id] === STATE_ACTIVE;
  const wasCompleted = id in prevAgg && prevAgg[id] === STATE_COMPLETED;

  return (nextAgg[id] === STATE_ACTIVE && !wasActive)
    || (nextAgg[id] === STATE_COMPLETED && !wasCompleted);
}

/**
 * The outgoing flow `gateway` took in the step `prevAgg -> nextAgg`: the one
 * that leads to an element the step moved, either directly or through
 * gateways that hold no token. The walk stops at any other element the step
 * did not move, because a task or an event there would still be holding the
 * token.
 *
 * @param {Object} gateway the exclusive gateway, a diagram element
 * @param {Object<string, number|string>} prevAgg the step's first snapshot,
 *   aggregated by element (aggregateByElement in ./modeler.js)
 * @param {Object<string, number|string>} nextAgg its second snapshot, the same
 *
 * @return {Object|null} the flow, or null when no way leads to a move
 */
export function flowTakenBy(gateway, prevAgg, nextAgg) {
  const leadsToMove = (element, seen) => {
    if (movedBy(prevAgg, nextAgg, element.id)) {
      return true;
    }

    if (!PASSING_GATEWAYS.has(element.type) || seen.has(element)) {
      return false;
    }

    seen.add(element);

    return sequenceFlows(element.outgoing).some(flow => leadsToMove(flow.target, seen));
  };

  const taken = sequenceFlows(gateway.outgoing).filter(
    flow => leadsToMove(flow.target, new Set([ gateway ]))
  );

  if (taken.length > 1) {
    throw new Error(
      `${gateway.id}: the step leads to a move behind ${taken.length} of its flows ` +
      `(${taken.map(flow => flow.id).join(', ')}), so the snapshots do not say which one it took`
    );
  }

  return taken.length === 1 ? taken[0] : null;
}

/**
 * The outgoing flow a replay sends an exclusive gateway's token down, read off
 * the snapshot it replays to: the one whose target the snapshot has
 * COMPLETED, and when none is completed, the one whose target it has ACTIVE.
 * The second case is the branch the token is in right now.
 *
 * WHY THE SECOND LOOK. Until 2026-11-17 only a completed target was looked
 * for (_replayFromStart and navigateForward in ./modeler.js, since b39fb08 on
 * 2026-04-10). When the step has just entered the branch, the branch's first
 * task is active and nothing behind the gateway is completed. The gateway was
 * then left unlocked, and upstream's default sent the token down its other
 * flow. Measured on the Simulator's combined report of ship.bpmn: at t=435,
 * Gateway_1bd0yk0 completed and Activity_0szusuq («move trailer on site»)
 * active, the token stood on Activity_058n5ws («Notify administration»), in
 * nodes 10, 12 and 14 of its tree. A completed target is still looked for
 * first, so every replay that found one goes as before.
 *
 * @param {Object} gateway the exclusive gateway, a diagram element
 * @param {Set<string>} completedIds the elements the snapshot has completed
 * @param {Set<string>} activeIds the elements the snapshot has active
 *
 * @return {Object|null} the flow, or null when no target is either
 */
export function flowTowardsTargetState(gateway, completedIds, activeIds) {
  const outgoing = sequenceFlows(gateway.outgoing);

  const towardsCompleted = outgoing.find(flow => completedIds.has(flow.target.id));

  if (towardsCompleted !== undefined) {
    return towardsCompleted;
  }

  const towardsActive = outgoing.find(flow => activeIds.has(flow.target.id));

  if (towardsActive !== undefined) {
    return towardsActive;
  }

  return null;
}
