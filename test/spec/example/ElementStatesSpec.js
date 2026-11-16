import { expect } from 'chai';

import {
  ACTIVITY_STATE_NAME,
  NONE_OF_THE_THREE,
  STATE_ACTIVE,
  STATE_COMPLETED,
  STATE_FAILED,
  STATE_SKIPPED,
  STATE_TERMINATED,
  STATE_UNKNOWN,
  STATE_WAITING,
  aggregateByRootToken,
  aggregateStatusesByElement,
  aggregateTokenStatuses,
  rootTokenOf
} from '../../../example/src/element-states';


/**
 * Every ordering of `items`.
 */
function permutations(items) {
  if (items.length < 2) {
    return [ items ];
  }

  const result = [];

  items.forEach((item, index) => {
    const rest = items.slice(0, index).concat(items.slice(index + 1));

    permutations(rest).forEach(tail => {
      result.push([ item ].concat(tail));
    });
  });

  return result;
}


describe('example/element-states', function() {

  describe('aggregateTokenStatuses', function() {

    it('should be ACTIVE when any token is ACTIVE', function() {
      expect(aggregateTokenStatuses('Task_1', [ STATE_FAILED, STATE_ACTIVE, STATE_COMPLETED ])).to.equal(STATE_ACTIVE);
    });


    it('should be COMPLETED when no token is ACTIVE and any is COMPLETED', function() {
      expect(aggregateTokenStatuses('Task_1', [ STATE_WAITING, STATE_COMPLETED, STATE_FAILED ])).to.equal(STATE_COMPLETED);
    });


    it('should be WAITING only when every token is WAITING', function() {
      expect(aggregateTokenStatuses('Task_1', [ STATE_WAITING, STATE_WAITING ])).to.equal(STATE_WAITING);
      expect(aggregateTokenStatuses('Task_1', [ STATE_WAITING ])).to.equal(STATE_WAITING);
    });


    it('should be NONE_OF_THE_THREE for every other mix', function() {
      expect(aggregateTokenStatuses('Task_1', [ STATE_WAITING, STATE_FAILED ])).to.equal(NONE_OF_THE_THREE);
      expect(aggregateTokenStatuses('Task_1', [ STATE_SKIPPED ])).to.equal(NONE_OF_THE_THREE);
      expect(aggregateTokenStatuses('Task_1', [ STATE_UNKNOWN, STATE_TERMINATED ])).to.equal(NONE_OF_THE_THREE);
    });


    it('should not be any of the ten ActivityState codes when it is NONE_OF_THE_THREE', function() {
      expect(ACTIVITY_STATE_NAME.has(NONE_OF_THE_THREE)).to.be.false;
    });


    it('should not depend on the order of the tokens', function() {

      // the pair the order-dependent merge decided by its first key:
      // WAITING then FAILED gave WAITING, FAILED then WAITING gave FAILED
      expect(aggregateTokenStatuses('Task_1', [ STATE_WAITING, STATE_FAILED ]))
        .to.equal(aggregateTokenStatuses('Task_1', [ STATE_FAILED, STATE_WAITING ]));

      const lists = [
        [ STATE_WAITING, STATE_FAILED, STATE_SKIPPED ],
        [ STATE_WAITING, STATE_COMPLETED, STATE_TERMINATED ],
        [ STATE_FAILED, STATE_ACTIVE, STATE_WAITING, STATE_COMPLETED ],
        [ STATE_WAITING, STATE_WAITING, STATE_UNKNOWN ]
      ];

      lists.forEach(statuses => {
        const answers = new Set(
          permutations(statuses).map(order => aggregateTokenStatuses('Task_1', order))
        );

        expect([ ...answers ], `statuses ${JSON.stringify(statuses)}`).to.have.length(1);
      });
    });


    it('should raise on a code outside the ten, naming the element and the code', function() {
      expect(() => aggregateTokenStatuses('Task_7', [ STATE_WAITING, 9 ]))
        .to.throw(/Element "Task_7" has a token whose status 9 is not one of the ten ActivityState codes/);

      expect(() => aggregateTokenStatuses('Task_7', [ '1' ]))
        .to.throw(/Element "Task_7" has a token whose status "1" is not one/);
    });


    it('should raise on an element with no token', function() {
      expect(() => aggregateTokenStatuses('Task_7', [])).to.throw(/Element "Task_7" has no token status/);
    });

  });


  describe('aggregateStatusesByElement', function() {

    it('should give every element the same status whatever the order of the keys', function() {

      // two elements whose tokens interleave, as a snapshot's keys may
      const tokens = [
        [ 'Task_1', STATE_WAITING ],
        [ 'Task_2', STATE_COMPLETED ],
        [ 'Task_1', STATE_FAILED ],
        [ 'Task_2', STATE_WAITING ]
      ];

      permutations(tokens).forEach(order => {
        const aggregate = aggregateStatusesByElement(order);

        expect(aggregate, JSON.stringify(order)).to.eql({
          Task_1: NONE_OF_THE_THREE,
          Task_2: STATE_COMPLETED
        });
      });
    });


    it('should list the elements in the order of their first token', function() {
      const aggregate = aggregateStatusesByElement([
        [ 'Task_2', STATE_WAITING ],
        [ 'Task_1', STATE_ACTIVE ],
        [ 'Task_2', STATE_ACTIVE ]
      ]);

      expect(Object.keys(aggregate)).to.eql([ 'Task_2', 'Task_1' ]);
      expect(aggregate.Task_2).to.equal(STATE_ACTIVE);
    });


    it('should raise on an unknown code, naming the element', function() {
      expect(() => aggregateStatusesByElement([
        [ 'Task_1', STATE_ACTIVE ],
        [ 'Gateway_3', 12 ]
      ])).to.throw(/Element "Gateway_3" has a token whose status 12/);
    });

  });


  describe('rootTokenOf', function() {

    it('should be the first two parts of a split token', function() {
      expect(rootTokenOf('tok_0_0')).to.equal('tok_0');
      expect(rootTokenOf('tok_0_1_2')).to.equal('tok_0');
    });


    it('should be the token itself when it is not split', function() {
      expect(rootTokenOf('tok_3')).to.equal('tok_3');
      expect(rootTokenOf('token')).to.equal('token');
    });

  });


  describe('aggregateByRootToken', function() {

    it('should give a root the same status whatever the order of its tokens', function() {

      // FAILED then TERMINATED gave FAILED in the state panel, and
      // TERMINATED then FAILED gave TERMINATED
      const tokens = [
        [ 'tok_0_0', STATE_FAILED ],
        [ 'tok_0_1', STATE_TERMINATED ],
        [ 'tok_1', STATE_WAITING ]
      ];

      permutations(tokens).forEach(order => {
        const roots = aggregateByRootToken('Task_1@Process_1', order);

        expect(roots.get('tok_0').status, JSON.stringify(order)).to.equal(NONE_OF_THE_THREE);
        expect(roots.get('tok_1').status, JSON.stringify(order)).to.equal(STATE_WAITING);
      });
    });


    it('should read a first WAITING token as a status', function() {

      // the panel's merge read the code 0 as no status, so the FAILED token
      // after it replaced it
      const roots = aggregateByRootToken('Task_1', [
        [ 'tok_0_0', STATE_WAITING ],
        [ 'tok_0_1', STATE_FAILED ]
      ]);

      expect(roots.get('tok_0')).to.eql({
        status: NONE_OF_THE_THREE,
        statuses: [ STATE_WAITING, STATE_FAILED ]
      });
    });


    it('should apply the element rule to each root', function() {
      const roots = aggregateByRootToken('Task_1', [
        [ 'tok_0_0', STATE_WAITING ],
        [ 'tok_0_1', STATE_ACTIVE ],
        [ 'tok_1_0', STATE_COMPLETED ],
        [ 'tok_1_1', STATE_SKIPPED ]
      ]);

      expect([ ...roots.keys() ]).to.eql([ 'tok_0', 'tok_1' ]);
      expect(roots.get('tok_0').status).to.equal(STATE_ACTIVE);
      expect(roots.get('tok_1').status).to.equal(STATE_COMPLETED);
    });


    it('should raise on an unknown code, naming the element and the root token', function() {
      expect(() => aggregateByRootToken('Task_1@Process_1', [ [ 'tok_0_0', 8 ] ]))
        .to.throw(/Element "Task_1@Process_1#tok_0" has a token whose status 8/);
    });

  });

});
