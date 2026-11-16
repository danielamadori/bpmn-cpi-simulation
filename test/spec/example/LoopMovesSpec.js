import { expect } from 'chai';

import SimulatorModule from 'lib/simulator';

import {
  bootstrapModeler,
  getBpmnJS
} from 'test/TestHelper';

import {
  LOOP_MOVES,
  LoopSteering,
  isUnkeyedDecision,
  isUnkeyedPassThrough,
  loopMovesOf,
  queueLoopMoves,
  requireLoopMoves
} from '../../../example/src/loop-moves';

const whileDiagram = require('./LoopMoves.while.bpmn');
const doWhileDiagram = require('./LoopMoves.do-while.bpmn');

// The elements the Simulator's snapshots name for both loop models: its state
// keys are Start, T1, T2 and End, and none is a gateway.
const KEYED = new Set([ 'Start', 'T1', 'T2', 'End' ]);


/**
 * A path as a host sends it: t0, then one step per node, each with the moves
 * `moves` lists for it.
 */
function path(...moves) {
  return [ [] ].concat(moves).map((stepMoves, index) => ({
    name: `t${index}`,
    state: {},
    [LOOP_MOVES]: stepMoves
  }));
}

function get(name) {
  return getBpmnJS().get(name);
}

function element(id) {
  const found = get('elementRegistry').get(id);

  if (found === undefined) {
    throw new Error(`no element <${id}>`);
  }

  return found;
}


/**
 * Bootstrap `diagram` with the simulator alone (no animation: a token runs as
 * far as it can within `trigger`), and a record of every element entered.
 *
 * `context` is the test's own `this`, which bpmn-js's helper reads for its
 * test container. The reset after the import creates the root scopes, whose
 * subscriptions a start event is triggered through (the simulator spec does
 * the same).
 */
async function bootstrap(context, diagram) {
  const { err } = await bootstrapModeler(diagram, {
    additionalModules: [ SimulatorModule ]
  }).call(context);

  if (err) {
    throw err;
  }

  get('simulator').reset();

  const entered = [];

  get('simulator').on('trace', event => {
    if (event.action === 'enter') {
      entered.push(event.element.id);
    }
  });

  return entered;
}


/**
 * Configure the diagram as the replay does for a snapshot where everything the
 * keys name is done: every element lets the token through, and the loop
 * decisions are steered by the moves of `steps[1..last]`.
 */
function replay(steering, steps) {
  const simulator = get('simulator');
  const elementRegistry = get('elementRegistry');

  elementRegistry.getAll().forEach(el => {
    if (el.type !== 'bpmn:Process') {
      simulator.setConfig(el, { wait: false });
    }
  });

  steering.steer(queueLoopMoves(steps, 1, steps.length - 1, elementRegistry, KEYED));

  simulator.trigger(simulator.findSubscription({ element: element('Start') }));
}

function count(entered, id) {
  return entered.filter(entry => entry === id).length;
}

function holdingAt(id) {
  return get('simulator').findScopes(scope => !scope.destroyed && scope.element.id === id);
}


describe('example - loop moves', function() {

  describe('a step names its loop moves', function() {

    it('reads them', function() {
      expect(loopMovesOf({ name: 't1', state: {}, [LOOP_MOVES]: [ 'f_body' ] }, 'step 1'))
        .to.eql([ 'f_body' ]);
    });


    it('refuses a step that does not carry them', function() {
      expect(() => loopMovesOf({ name: 't1', state: {} }, 'step 1'))
        .to.throw(/step 1: the step has no "loop_moves"/);
    });


    it('refuses moves that are not an array of flow ids', function() {
      expect(() => loopMovesOf({ [LOOP_MOVES]: 'f_body' }, 'step 1')).to.throw(/not an array/);
      expect(() => loopMovesOf({ [LOOP_MOVES]: [ '' ] }, 'step 1')).to.throw(/not a flow id/);
      expect(() => loopMovesOf({ [LOOP_MOVES]: [ 3 ] }, 'step 1')).to.throw(/not a flow id/);
    });


    it('names the step of a path that does not carry them', function() {
      const steps = path([ 'f_body' ], []);
      delete steps[2][LOOP_MOVES];

      expect(() => requireLoopMoves(steps, 'loadStates "states"'))
        .to.throw(/loadStates "states", step 2: the step has no "loop_moves"/);
    });

  });


  describe('the gateways a snapshot leaves open', function() {

    beforeEach(async function() {
      await bootstrap(this, whileDiagram);
    });


    it('a loop decision has no key and two ways out', function() {
      expect(isUnkeyedDecision(element('Gw_check'), KEYED)).to.be.true;
      expect(isUnkeyedPassThrough(element('Gw_check'), KEYED)).to.be.false;
    });


    it('a loop exit has no key and one way out: it lets the token through', function() {
      expect(isUnkeyedPassThrough(element('Gw_exit'), KEYED)).to.be.true;
      expect(isUnkeyedDecision(element('Gw_exit'), KEYED)).to.be.false;
    });


    it('a gateway a key names is the snapshot\'s, not the moves\'', function() {
      const keyed = new Set([ ...KEYED, 'Gw_check', 'Gw_exit' ]);

      expect(isUnkeyedDecision(element('Gw_check'), keyed)).to.be.false;
      expect(isUnkeyedPassThrough(element('Gw_exit'), keyed)).to.be.false;
    });

  });


  describe('queueing', function() {

    beforeEach(async function() {
      await bootstrap(this, whileDiagram);
    });


    it('queues each move under the gateway it leaves, in order', function() {
      const queues = queueLoopMoves(path([ 'f_body' ], [ 'f_body' ], [ 'f_exit' ]), 1, 3,
        get('elementRegistry'), KEYED);

      expect([ ...queues.keys() ]).to.eql([ 'Gw_check' ]);
      expect(queues.get('Gw_check').flows.map(flow => flow.id))
        .to.eql([ 'f_body', 'f_body', 'f_exit' ]);
    });


    it('queues only the steps it is asked for', function() {
      const queues = queueLoopMoves(path([ 'f_body' ], [ 'f_body' ], [ 'f_exit' ]), 3, 3,
        get('elementRegistry'), KEYED);

      expect(queues.get('Gw_check').flows.map(flow => flow.id)).to.eql([ 'f_exit' ]);
    });


    it('gives an unmoved decision an empty queue', function() {
      const queues = queueLoopMoves(path([]), 1, 1, get('elementRegistry'), KEYED);

      expect(queues.get('Gw_check').flows).to.eql([]);
    });


    it('refuses a move the diagram does not hold', function() {
      expect(() => queueLoopMoves(path([ 'f_nowhere' ]), 1, 1, get('elementRegistry'), KEYED))
        .to.throw(/step 1: loop move "f_nowhere" is not an element of this diagram/);
    });


    it('refuses a move that leaves no open decision', function() {
      expect(() => queueLoopMoves(path([ 'f2' ]), 1, 1, get('elementRegistry'), KEYED))
        .to.throw(/leaves T1, which is not a decision/);
    });


    it('refuses a move that is not a sequence flow', function() {
      expect(() => queueLoopMoves(path([ 'T2' ]), 1, 1, get('elementRegistry'), KEYED))
        .to.throw(/is a bpmn:Task, not a sequence flow/);
    });


    it('leaves a called process\'s moves to the called process', function() {
      const queues = queueLoopMoves(path([ 'CALL::f_body' ]), 1, 1, get('elementRegistry'), KEYED);

      expect(queues.get('Gw_check').flows).to.eql([]);
    });

  });


  describe('steering a while', function() {

    let entered;
    let steering;

    beforeEach(async function() {
      entered = await bootstrap(this, whileDiagram);
      steering = new LoopSteering(get('simulator'));
    });


    it('runs six laps and holds at the decision (node 11)', function() {

      // when
      replay(steering, path([], [ 'f_body' ], [ 'f_body' ], [ 'f_body' ], [ 'f_body' ],
        [ 'f_body' ], [ 'f_body' ]));

      // then
      expect(count(entered, 'T2')).to.eql(6);
      expect(count(entered, 'Gw_check')).to.eql(7);
      expect(count(entered, 'End')).to.eql(0);
      expect(holdingAt('Gw_check')).to.have.length(1);
      expect(steering.untaken()).to.eql({});
    });


    it('runs five laps and leaves (node 10)', function() {

      // when
      replay(steering, path([], [ 'f_body' ], [ 'f_body' ], [ 'f_body' ], [ 'f_body' ],
        [ 'f_body' ], [ 'f_exit' ]));

      // then
      expect(count(entered, 'T2')).to.eql(5);
      expect(count(entered, 'Gw_exit')).to.eql(1);
      expect(count(entered, 'End')).to.eql(1);
      expect(holdingAt('Gw_check')).to.have.length(0);
      expect(steering.untaken()).to.eql({});
    });


    it('holds at a decision no move has taken yet', function() {

      // when
      replay(steering, path([]));

      // then
      expect(count(entered, 'T2')).to.eql(0);
      expect(holdingAt('Gw_check')).to.have.length(1);
    });


    it('releases a held token with the next step\'s move, as a step forward does', function() {

      // given
      replay(steering, path([], [ 'f_body' ]));

      expect(count(entered, 'T2')).to.eql(1);

      const [ held ] = holdingAt('Gw_check');

      // when
      steering.steer(queueLoopMoves(path([], [ 'f_body' ], [ 'f_body' ]), 3, 3,
        get('elementRegistry'), KEYED));

      expect(steering.release(element('Gw_check'))).to.be.true;

      get('simulator').signal({ scope: held, element: element('Gw_check') });

      // then
      expect(count(entered, 'T2')).to.eql(2);
      expect(holdingAt('Gw_check')).to.have.length(1);
    });


    it('does not release a held token the next step did not move', function() {

      // given
      replay(steering, path([], [ 'f_body' ]));

      // when
      steering.steer(queueLoopMoves(path([], [ 'f_body' ], []), 3, 3,
        get('elementRegistry'), KEYED));

      // then
      expect(steering.release(element('Gw_check'))).to.be.false;
      expect(get('simulator').getConfig(element('Gw_check')).wait).to.be.true;
    });


    it('steers no more after a reset', function() {

      // given
      replay(steering, path([ 'f_body' ]));

      expect(steering.isSteering()).to.be.true;

      // when
      get('simulator').reset();

      // then
      expect(steering.isSteering()).to.be.false;
      expect(steering.steers('Gw_check')).to.be.false;
      expect(() => steering.takeNext('Gw_check')).to.throw(/not a gateway this replay steers/);
    });


    it('leaves the lock of the decision it steers as it was', function() {

      // when
      replay(steering, path([]));

      // then
      expect(get('simulator').getConfig(element('Gw_check')).locked).not.to.exist;
    });

  });


  describe('steering a do-while', function() {

    let entered;
    let steering;

    beforeEach(async function() {
      entered = await bootstrap(this, doWhileDiagram);
      steering = new LoopSteering(get('simulator'));
    });


    it('enters through the merge, then each lap is the backward flow', function() {

      // when -- the entry moves no decision: the body runs before the first one
      replay(steering, path([], [], [ 'f_back' ], [ 'f_back' ], [ 'f_exit' ]));

      // then
      expect(count(entered, 'T2')).to.eql(3);
      expect(count(entered, 'Gw_merge')).to.eql(3);
      expect(count(entered, 'End')).to.eql(1);
      expect(steering.untaken()).to.eql({});
    });


    it('holds at the decision after the first lap when nothing moved it', function() {

      // when
      replay(steering, path([], []));

      // then
      expect(count(entered, 'T2')).to.eql(1);
      expect(holdingAt('Gw_check')).to.have.length(1);
    });

  });

});
