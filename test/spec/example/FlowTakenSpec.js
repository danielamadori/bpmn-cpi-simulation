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

import { flowTakenBy } from '../../../example/src/flow-taken';

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
