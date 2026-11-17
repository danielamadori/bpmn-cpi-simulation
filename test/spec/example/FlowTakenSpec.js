import { expect } from 'chai';

import {
  bootstrapModeler,
  getBpmnJS
} from 'test/TestHelper';

import {
  STATE_ACTIVE,
  STATE_COMPLETED,
  STATE_WAITING
} from '../../../example/src/element-states';

import {
  flowTakenBy,
  flowTowardsTargetState
} from '../../../example/src/flow-taken';

const loopDiagram = require('../../../new_example/two_tasks_one_pool_in_a_loop.bpmn');
const natureDiagram = require('../../../new_example/nature_two_outcomes.bpmn');


function element(id) {
  const found = getBpmnJS().get('elementRegistry').get(id);

  if (found === undefined) {
    throw new Error(`no element <${id}>`);
  }

  return found;
}

function taken(gatewayId, prevAgg, nextAgg) {
  const flow = flowTakenBy(element(gatewayId), prevAgg, nextAgg);

  return flow === null ? null : flow.id;
}


describe('example - flow taken by an exclusive gateway', function() {

  describe('a decision whose ways begin with a gateway', function() {

    beforeEach(bootstrapModeler(loopDiagram));

    // The keyed elements of states/two_tasks_one_pool_in_a_loop as the replay
    // aggregates them, with Gw_check at the end of a lap.
    const endOfLap = {
      Start_R: STATE_COMPLETED,
      Gw_split: STATE_COMPLETED,
      T_A: STATE_COMPLETED,
      T_B: STATE_COMPLETED,
      Gw_check: STATE_ACTIVE,
      End_R: STATE_WAITING
    };


    it('should go back when the step starts another lap', function() {

      // when
      // T_A and T_B are active again: behind f_back, over Gw_entry and
      // Gw_split, which hold no token
      const flow = taken('Gw_check', endOfLap, {
        ...endOfLap,
        Gw_check: STATE_COMPLETED,
        T_A: STATE_ACTIVE,
        T_B: STATE_ACTIVE
      });

      // then
      expect(flow).to.equal('f_back');
    });


    it('should leave when the step completes the end event', function() {

      // when
      // End_R goes from waiting to completed, behind f_exit and Gw_after
      const flow = taken('Gw_check', endOfLap, {
        ...endOfLap,
        Gw_check: STATE_COMPLETED,
        End_R: STATE_COMPLETED
      });

      // then
      expect(flow).to.equal('f_exit');
    });


    it('should say nothing when the step moved nothing behind its flows', function() {

      // when
      const flow = taken('Gw_check', endOfLap, {
        ...endOfLap,
        Gw_check: STATE_COMPLETED
      });

      // then
      expect(flow).to.be.null;
    });


    it('should refuse a step that moved something behind both flows', function() {

      // then
      expect(() => taken('Gw_check', endOfLap, {
        ...endOfLap,
        Gw_check: STATE_COMPLETED,
        T_A: STATE_ACTIVE,
        End_R: STATE_COMPLETED
      })).to.throw('Gw_check: the step leads to a move behind 2 of its flows (f_back, f_exit)');
    });

  });


  describe('a decision whose ways begin with a task', function() {

    beforeEach(bootstrapModeler(natureDiagram));

    it('should take the flow to the task that became active', function() {

      // given
      const atDecision = {
        Start_QC: STATE_COMPLETED,
        T_Inspect: STATE_COMPLETED,
        GW_Nature: STATE_ACTIVE,
        T_Dispatch: STATE_WAITING,
        T_Rework: STATE_WAITING,
        End_QC: STATE_WAITING
      };

      // when
      const flow = taken('GW_Nature', atDecision, {
        ...atDecision,
        GW_Nature: STATE_COMPLETED,
        T_Rework: STATE_ACTIVE
      });

      // then
      expect(flow).to.equal('F3b');
    });

  });

});


describe('example - flow a replay sends a completed exclusive gateway down', function() {

  beforeEach(bootstrapModeler(natureDiagram));

  function towards(completed, active) {
    const flow = flowTowardsTargetState(element('GW_Nature'), new Set(completed), new Set(active));

    return flow === null ? null : flow.id;
  }


  it('should go towards the completed target', function() {

    // then
    expect(towards([ 'GW_Nature', 'T_Rework' ], [])).to.equal('F3b');
  });


  it('should go towards the active target when none is completed', function() {

    // when
    // the step has just entered the branch: its task is active, nothing
    // behind the gateway is completed (ship.bpmn's Gateway_1bd0yk0 at
    // t=435, whose token went down the other flow before)
    const flow = towards([ 'GW_Nature' ], [ 'T_Rework' ]);

    // then
    expect(flow).to.equal('F3b');
  });


  it('should prefer a completed target to an active one', function() {

    // then
    // as before the active target was looked at: a replay that found a
    // completed target goes the same way
    expect(towards([ 'GW_Nature', 'T_Dispatch' ], [ 'T_Rework' ])).to.equal('F3a');
  });


  it('should say nothing when no target is completed or active', function() {

    // then
    expect(towards([ 'GW_Nature' ], [])).to.be.null;
  });

});
