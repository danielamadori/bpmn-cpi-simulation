/**
 * The flows a path's loop decisions took, and how the replay steers a loop's
 * decision gateway with them.
 *
 * A module of its own so that a Karma spec can import it: importing
 * `modeler.js` builds the whole page.
 *
 * WHY IT EXISTS. Measured 2026-11-16 on the Simulator's combined report of
 * `tests/fixtures/bpmn/ciclo_condizionale.bpmn` (a while: `Gw_check` takes
 * `f_body` to T2, T2 comes back over `f_back`, or `f_exit` leaves through
 * `Gw_exit` to End): after any non-root node of the execution tree the token
 * went round `f_body -> T2 -> f_back` forever, 297 laps in 10 s, and held the
 * one-slot pending replay request for the whole 10 s of `drainSimulationQueues`.
 * A loop's decision gateway has no key in a snapshot (the Simulator maps no
 * BPMN element to a loop region) and the state fold is monotonic, so the
 * snapshots cannot say how many laps were run or where the decision went. The
 * replay used to force such a gateway through (it has two incoming flows, so
 * it was treated as a join) and upstream's default sent it down its first
 * outgoing flow every time.
 *
 * WHAT A STEP CARRIES NOW: `loop_moves`, the BPMN sequence-flow ids the step's
 * loop decisions took, in firing order (the Simulator's `_loop_moves_of`,
 * `src/sese_tooling/_api/_snapshot_views.py`). The replay queues the moves of
 * the steps it replays, each under the gateway the flow leaves, and every time
 * a token enters such a gateway it takes the next queued flow. When none is
 * queued the decision is still to be taken, and the token holds there.
 */

/** The key of a path step that names its loop moves. */
export const LOOP_MOVES = 'loop_moves';

/**
 * The separator of an element an inlined call brought in: the Simulator spells
 * its id `CALL::f_body`, as it spells its state key (`CALL_SCOPE_SEP`,
 * `src/parser/call_activity.py`). A BPMN id cannot hold a colon, so such an id
 * names a flow of the called process, which this canvas does not draw.
 */
export const CALL_SCOPE_SEP = '::';

/**
 * The loop moves of one path step, refusing a step that does not carry them.
 *
 * REQUIRED, NOT DEFAULTED: a step without the field comes from a host that
 * does not send it, and replaying it as "no loop moved" is exactly the defect
 * this module exists to remove -- the token would go round forever again.
 *
 * @param {Object} step a path step, `{ name, state, loop_moves }`
 * @param {string} where what the step is, for the error that names it
 *
 * @return {Array<string>}
 */
export function loopMovesOf(step, where) {
  if (step === null || typeof step !== 'object') {
    throw new Error(`${where}: a path step must be an object, not ${JSON.stringify(step)}`);
  }

  if (!(LOOP_MOVES in step)) {
    throw new Error(
      `${where}: the step has no "${LOOP_MOVES}" (it has: ${Object.keys(step).join(', ')}); ` +
      'a host must say which flows its loop decisions took, [] when none'
    );
  }

  const moves = step[LOOP_MOVES];

  if (!Array.isArray(moves)) {
    throw new Error(`${where}: "${LOOP_MOVES}" is ${JSON.stringify(moves)}, not an array of flow ids`);
  }

  moves.forEach((move, index) => {
    if (typeof move !== 'string' || move.length === 0) {
      throw new Error(`${where}: "${LOOP_MOVES}"[${index}] is ${JSON.stringify(move)}, not a flow id`);
    }
  });

  return moves;
}

/**
 * Refuse a path of which any step does not carry its loop moves.
 *
 * @param {Array<Object>} steps
 * @param {string} where
 */
export function requireLoopMoves(steps, where) {
  if (!Array.isArray(steps)) {
    throw new Error(`${where}: a path must be an array of steps, not ${JSON.stringify(steps)}`);
  }

  steps.forEach((step, index) => loopMovesOf(step, `${where}, step ${index}`));
}

function isExclusiveGateway(element) {
  return element.type === 'bpmn:ExclusiveGateway';
}

function sequenceFlows(flows) {
  return flows.filter(flow => flow.type === 'bpmn:SequenceFlow');
}

/**
 * An exclusive gateway no snapshot key names, with two outgoing flows or more:
 * a decision only the loop moves can say the outcome of. A loop's decision
 * gateway is one -- `Gw_check` of both loop fixtures -- and nothing in the
 * snapshot names the flow it took.
 *
 * @param {Object} element a diagram element
 * @param {Set<string>} keyedIds the element ids the snapshot's keys name
 *
 * @return {boolean}
 */
export function isUnkeyedDecision(element, keyedIds) {
  return isExclusiveGateway(element)
    && !keyedIds.has(element.id)
    && sequenceFlows(element.outgoing).length > 1;
}

/**
 * An exclusive gateway no snapshot key names, with one outgoing flow: it has
 * nothing to decide, so it lets a token through. A loop's exit gateway is one
 * (`Gw_exit`), and so is a do-while's merge; the snapshot never names them, so
 * holding a token there -- what the replay did with a gateway that has one
 * incoming flow -- stopped the token short of an End the snapshot shows done.
 *
 * @param {Object} element a diagram element
 * @param {Set<string>} keyedIds the element ids the snapshot's keys name
 *
 * @return {boolean}
 */
export function isUnkeyedPassThrough(element, keyedIds) {
  return isExclusiveGateway(element)
    && !keyedIds.has(element.id)
    && sequenceFlows(element.outgoing).length === 1;
}

/**
 * The loop moves of `steps[firstIndex..lastIndex]`, queued under the decision
 * each flow leaves, in firing order.
 *
 * EVERY UNKEYED DECISION OF THE DIAGRAM HAS A QUEUE, an empty one when no step
 * moved it: a token that reaches it then holds, which is what a decision still
 * to be taken looks like. A move that names no flow of the diagram, or a flow
 * that does not leave an unkeyed decision, is refused: the host and the
 * diagram disagree, and steering a gateway the move does not belong to would
 * draw a run that did not happen.
 *
 * @param {Array<Object>} steps the path's steps
 * @param {number} firstIndex the first step whose moves are queued
 * @param {number} lastIndex the last one, included
 * @param {Object} elementRegistry `getAll()` and `get(id)`
 * @param {Set<string>} keyedIds the element ids the snapshot's keys name
 *
 * @return {Map<string, { gateway: Object, flows: Array<Object> }>} by gateway id
 */
export function queueLoopMoves(steps, firstIndex, lastIndex, elementRegistry, keyedIds) {
  const queues = new Map();

  elementRegistry.getAll()
    .filter(element => isUnkeyedDecision(element, keyedIds))
    .forEach(gateway => queues.set(gateway.id, { gateway, flows: [] }));

  for (let index = firstIndex; index <= lastIndex; index++) {
    const where = `step ${index}`;

    loopMovesOf(steps[index], where).forEach(move => {

      // A FLOW OF A CALLED PROCESS: its id carries the call (`CALL::f_body`),
      // and this canvas draws the caller only. Its laps are the callee's, so
      // no gateway here is steered by it.
      if (move.includes(CALL_SCOPE_SEP)) {
        return;
      }

      const flow = elementRegistry.get(move);

      if (flow === undefined) {
        throw new Error(`${where}: loop move "${move}" is not an element of this diagram`);
      }

      if (flow.type !== 'bpmn:SequenceFlow') {
        throw new Error(`${where}: loop move "${move}" is a ${flow.type}, not a sequence flow`);
      }

      if (!queues.has(flow.source.id)) {
        throw new Error(
          `${where}: loop move "${move}" leaves ${flow.source.id}, which is not a decision ` +
          'the snapshot leaves open (an exclusive gateway with no key and two outgoing flows or more)'
        );
      }

      queues.get(flow.source.id).flows.push(flow);
    });
  }

  return queues;
}

/**
 * Steers the loop decisions of a replay: each time a token enters a steered
 * gateway, the next queued flow is the one it takes, and with none queued it
 * holds there.
 *
 * It listens to the simulator's `trace` event, whose `enter` fires before the
 * gateway's behaviour runs (`lib/simulator/Simulator.js`, `enter`: `trace`
 * then `getBehavior(element).enter`), so the configuration it writes is the
 * one `ExclusiveGatewayBehavior` reads for that very visit. A `reset` of the
 * simulator ends the steering: the next replay queues its own moves.
 *
 * It adds no colour to anything: the token is what shows a lap.
 */
export class LoopSteering {

  /**
   * @param {Object} simulator the token simulation's `simulator`
   */
  constructor(simulator) {
    this._simulator = simulator;

    // `null`: no replay steers any gateway -- before the first replay and
    // after a reset. Otherwise the queues of `queueLoopMoves`.
    this._queues = null;

    simulator.on('trace', event => this._onTrace(event));
    simulator.on('reset', () => {
      this._queues = null;
    });
  }

  /**
   * Steer the gateways of `queues` from now on: each holds a token until a
   * visit finds a flow queued.
   *
   * NOT LOCKED: `locked` is read only by upstream's `ExclusiveGatewaySettings`,
   * whose colouring of a gateway's outgoing flows stays as it is (the owner's
   * decision of 2026-11-16, `AGENTS.md`), and by the gateway's context pad,
   * which calls it. A lock left on a gateway would change what that colouring
   * does the next time simulation mode turns on. The steering does not need
   * it: every visit sets its own flow.
   *
   * @param {Map<string, { gateway: Object, flows: Array<Object> }>} queues
   */
  steer(queues) {
    this._queues = queues;

    queues.forEach(({ gateway }) => {
      this._simulator.setConfig(gateway, { wait: true });
    });
  }

  /**
   * @return {boolean} whether a replay steers the gateways now (`steer` was
   *   called, and no reset came after it)
   */
  isSteering() {
    return this._queues !== null;
  }

  /**
   * @param {string} gatewayId
   *
   * @return {boolean} whether the replay steers this gateway
   */
  steers(gatewayId) {
    return this._queues !== null && this._queues.has(gatewayId);
  }

  /**
   * The flow the next visit of `gatewayId` takes, taken off its queue, or
   * `null` when none is queued: the decision is still to be taken.
   *
   * @param {string} gatewayId
   *
   * @return {Object|null}
   */
  takeNext(gatewayId) {
    if (!this.steers(gatewayId)) {
      throw new Error(`loop steering: ${gatewayId} is not a gateway this replay steers`);
    }

    const { flows } = this._queues.get(gatewayId);

    if (flows.length === 0) {
      return null;
    }

    return flows.shift();
  }

  /**
   * How many queued moves no token has taken yet, by gateway id: what a
   * replay that ended short of its snapshot left behind.
   *
   * @return {Object<string, number>}
   */
  untaken() {
    if (this._queues === null) {
      throw new Error('loop steering: no replay steers any gateway, so none has moves left');
    }

    const left = {};

    this._queues.forEach(({ flows }, gatewayId) => {
      if (flows.length > 0) {
        left[gatewayId] = flows.length;
      }
    });

    return left;
  }

  /**
   * Point a gateway that a token is entering, or holding at, at its next
   * queued flow; with none queued, make it hold.
   *
   * @param {Object} gateway
   *
   * @return {boolean} whether a flow was queued for this visit
   */
  release(gateway) {
    const flow = this.takeNext(gateway.id);

    if (flow === null) {
      this._simulator.setConfig(gateway, { wait: true });
      return false;
    }

    this._simulator.setConfig(gateway, { activeOutgoing: flow, wait: false });
    return true;
  }

  _onTrace(event) {
    if (event.action !== 'enter' || !this.steers(event.element.id)) {
      return;
    }

    this.release(event.element);
  }
}
