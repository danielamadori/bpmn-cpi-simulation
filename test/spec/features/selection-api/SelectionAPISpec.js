import { expect } from 'chai';

import { spy, stub } from 'sinon';

import EventBus from 'diagram-js/lib/core/EventBus';

import SelectionAPI from 'lib/features/selection-api/SelectionAPI';


describe('features - selection API', function() {

  let consoleError;

  beforeEach(function() {
    consoleError = stub(console, 'error');
  });

  afterEach(function() {
    consoleError.restore();
  });


  function createSelectionAPI() {
    const eventBus = new EventBus();

    const selection = {
      get() {
        return [];
      },
      select() {}
    };

    return {
      eventBus,
      selectionAPI: new SelectionAPI(eventBus, selection, {})
    };
  }


  it('should call the other listeners when one throws, and report it', function() {

    // given
    const { eventBus, selectionAPI } = createSelectionAPI();

    const failure = new Error('listener failure');

    selectionAPI.onSelectionChanged(function brokenListener() {
      throw failure;
    });

    const nextListener = spy();

    selectionAPI.onSelectionChanged(nextListener);

    const task = { id: 'Task_1' };

    // when
    eventBus.fire('selection.changed', { newSelection: [ task ], oldSelection: [] });

    // then
    expect(nextListener).to.have.been.calledOnceWith([ task ], []);

    expect(consoleError).to.have.been.calledOnce;
    expect(consoleError.firstCall.args[0]).to.match(
      /selection listener #0 \(function name "brokenListener"\) threw/
    );
    expect(consoleError.firstCall.args[1]).to.equal(failure);
  });

});
