import StartEventBehavior from './StartEventBehavior';
import EndEventBehavior from './EndEventBehavior';
import BoundaryEventBehavior from './BoundaryEventBehavior';
import IntermediateCatchEventBehavior from './IntermediateCatchEventBehavior';
import IntermediateThrowEventBehavior from './IntermediateThrowEventBehavior';

import ExclusiveGatewayBehavior from './ExclusiveGatewayBehavior';
import ParallelGatewayBehavior from './ParallelGatewayBehavior';
import EventBasedGatewayBehavior from './EventBasedGatewayBehavior';
import InclusiveGatewayBehavior from './InclusiveGatewayBehavior';

import ActivityBehavior from './ActivityBehavior';
import SubProcessBehavior from './SubProcessBehavior';
import TransactionBehavior from './TransactionBehavior';

import SequenceFlowBehavior from './SequenceFlowBehavior';
import MessageFlowBehavior from './MessageFlowBehavior';

import EventBehaviors from './EventBehaviors';
import ScopeBehavior from './ScopeBehavior';

import ProcessBehavior from './ProcessBehavior';


export default {
  __init__: [
    'startEventBehavior',
    'endEventBehavior',
    'boundaryEventBehavior',
    'intermediateCatchEventBehavior',
    'intermediateThrowEventBehavior',
    'exclusiveGatewayBehavior',
    'parallelGatewayBehavior',
    'eventBasedGatewayBehavior',
    'inclusiveGatewayBehavior',
    'subProcessBehavior',
    'sequenceFlowBehavior',
    'messageFlowBehavior',
    'processBehavior'
  ],
  startEventBehavior: [ 'type', [ 'simulator', 'activityBehavior', 'scopeBehavior', StartEventBehavior ] ],
  endEventBehavior: [ 'type', [ 'simulator', 'activityBehavior', 'scopeBehavior', EndEventBehavior ] ],
  boundaryEventBehavior: [ 'type', [ 'simulator', 'activityBehavior', 'scopeBehavior', BoundaryEventBehavior ] ],
  intermediateCatchEventBehavior: [ 'type', [ 'simulator', 'activityBehavior', 'scopeBehavior', IntermediateCatchEventBehavior ] ],
  intermediateThrowEventBehavior: [ 'type', [ 'simulator', 'activityBehavior', 'scopeBehavior', IntermediateThrowEventBehavior ] ],
  exclusiveGatewayBehavior: [ 'type', [ 'simulator', 'activityBehavior', 'scopeBehavior', ExclusiveGatewayBehavior ] ],
  parallelGatewayBehavior: [ 'type', [ 'simulator', 'activityBehavior', 'scopeBehavior', ParallelGatewayBehavior ] ],
  eventBasedGatewayBehavior: [ 'type', [ 'simulator', 'activityBehavior', 'scopeBehavior', EventBasedGatewayBehavior ] ],
  inclusiveGatewayBehavior: [ 'type', [ 'simulator', 'activityBehavior', 'scopeBehavior', InclusiveGatewayBehavior ] ],
  activityBehavior: [ 'type', [ 'simulator', 'scopeBehavior', 'transactionBehavior', ActivityBehavior ] ],
  subProcessBehavior: [ 'type', [ 'simulator', 'activityBehavior', 'scopeBehavior', SubProcessBehavior ] ],
  sequenceFlowBehavior: [ 'type', [ 'simulator', 'scopeBehavior', SequenceFlowBehavior ] ],
  messageFlowBehavior: [ 'type', [ 'simulator', 'scopeBehavior', MessageFlowBehavior ] ],
  eventBehaviors: [ 'type', [ 'injector', 'simulator', EventBehaviors ] ],
  scopeBehavior: [ 'type', [ 'simulator', ScopeBehavior ] ],
  processBehavior: [ 'type', [ 'simulator', 'activityBehavior', 'scopeBehavior', ProcessBehavior ] ],
  transactionBehavior: [ 'type', [ 'simulator', 'scopeBehavior', 'elementRegistry', TransactionBehavior ] ]
};