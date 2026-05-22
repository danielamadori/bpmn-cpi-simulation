/**
 * Pre-bundled bpmnlint config + resolver for browser use.
 * Shape: { config, resolver } as required by bpmn-js-bpmnlint.
 *
 * Includes: bpmnlint:recommended rules + sese custom rules.
 */

import taskHasDuration from './bpmnlint-plugin-sese/rules/task-has-duration.js'
import taskHasImpact from './bpmnlint-plugin-sese/rules/task-has-impact.js'

import ruleAdHocSubProcess from 'bpmnlint/rules/ad-hoc-sub-process'
import ruleConditionalFlows from 'bpmnlint/rules/conditional-flows'
import ruleEndEventRequired from 'bpmnlint/rules/end-event-required'
import ruleEventBasedGateway from 'bpmnlint/rules/event-based-gateway'
import ruleEventSubProcessTypedStartEvent from 'bpmnlint/rules/event-sub-process-typed-start-event'
import ruleFakeJoin from 'bpmnlint/rules/fake-join'
import ruleGlobal from 'bpmnlint/rules/global'
import ruleLabelRequired from 'bpmnlint/rules/label-required'
import ruleLinkEvent from 'bpmnlint/rules/link-event'
import ruleNoBpmndi from 'bpmnlint/rules/no-bpmndi'
import ruleNoComplexGateway from 'bpmnlint/rules/no-complex-gateway'
import ruleNoDisconnected from 'bpmnlint/rules/no-disconnected'
import ruleNoDuplicateSequenceFlows from 'bpmnlint/rules/no-duplicate-sequence-flows'
import ruleNoGatewayJoinFork from 'bpmnlint/rules/no-gateway-join-fork'
import ruleNoImplicitSplit from 'bpmnlint/rules/no-implicit-split'
import ruleNoImplicitEnd from 'bpmnlint/rules/no-implicit-end'
import ruleNoImplicitStart from 'bpmnlint/rules/no-implicit-start'
import ruleNoInclusiveGateway from 'bpmnlint/rules/no-inclusive-gateway'
import ruleNoOverlappingElements from 'bpmnlint/rules/no-overlapping-elements'
import ruleSingleBlankStartEvent from 'bpmnlint/rules/single-blank-start-event'
import ruleSingleEventDefinition from 'bpmnlint/rules/single-event-definition'
import ruleStartEventRequired from 'bpmnlint/rules/start-event-required'
import ruleSubProcessBlankStartEvent from 'bpmnlint/rules/sub-process-blank-start-event'
import ruleSuperfluousGateway from 'bpmnlint/rules/superfluous-gateway'
import ruleSuperfluousTermination from 'bpmnlint/rules/superfluous-termination'

const cache = {
  'bpmnlint/ad-hoc-sub-process': ruleAdHocSubProcess,
  'bpmnlint/conditional-flows': ruleConditionalFlows,
  'bpmnlint/end-event-required': ruleEndEventRequired,
  'bpmnlint/event-based-gateway': ruleEventBasedGateway,
  'bpmnlint/event-sub-process-typed-start-event': ruleEventSubProcessTypedStartEvent,
  'bpmnlint/fake-join': ruleFakeJoin,
  'bpmnlint/global': ruleGlobal,
  'bpmnlint/label-required': ruleLabelRequired,
  'bpmnlint/link-event': ruleLinkEvent,
  'bpmnlint/no-bpmndi': ruleNoBpmndi,
  'bpmnlint/no-complex-gateway': ruleNoComplexGateway,
  'bpmnlint/no-disconnected': ruleNoDisconnected,
  'bpmnlint/no-duplicate-sequence-flows': ruleNoDuplicateSequenceFlows,
  'bpmnlint/no-gateway-join-fork': ruleNoGatewayJoinFork,
  'bpmnlint/no-implicit-split': ruleNoImplicitSplit,
  'bpmnlint/no-implicit-end': ruleNoImplicitEnd,
  'bpmnlint/no-implicit-start': ruleNoImplicitStart,
  'bpmnlint/no-inclusive-gateway': ruleNoInclusiveGateway,
  'bpmnlint/no-overlapping-elements': ruleNoOverlappingElements,
  'bpmnlint/single-blank-start-event': ruleSingleBlankStartEvent,
  'bpmnlint/single-event-definition': ruleSingleEventDefinition,
  'bpmnlint/start-event-required': ruleStartEventRequired,
  'bpmnlint/sub-process-blank-start-event': ruleSubProcessBlankStartEvent,
  'bpmnlint/superfluous-gateway': ruleSuperfluousGateway,
  'bpmnlint/superfluous-termination': ruleSuperfluousTermination,
  'sese/task-has-duration': taskHasDuration,
  'sese/task-has-impact': taskHasImpact,
  'bpmnlint-plugin-sese/task-has-duration': taskHasDuration,
  'bpmnlint-plugin-sese/task-has-impact': taskHasImpact,
}

const resolver = {
  resolveRule(pkg, ruleName) {
    const rule = cache[`${pkg}/${ruleName}`]
    if (!rule) throw new Error(`unknown rule <${pkg}/${ruleName}>`)
    return rule
  },
  resolveConfig(pkg, configName) {
    throw new Error(`config resolution not supported: ${pkg}/${configName}`)
  }
}

const config = {
  rules: {
    'bpmnlint/ad-hoc-sub-process': 'error',
    'bpmnlint/conditional-flows': 'error',
    'bpmnlint/end-event-required': 'error',
    'bpmnlint/event-based-gateway': 'error',
    'bpmnlint/event-sub-process-typed-start-event': 'error',
    'bpmnlint/fake-join': 'warn',
    'bpmnlint/global': 'warn',
    'bpmnlint/label-required': 'warn',
    'bpmnlint/link-event': 'error',
    'bpmnlint/no-bpmndi': 'error',
    'bpmnlint/no-complex-gateway': 'error',
    'bpmnlint/no-disconnected': 'error',
    'bpmnlint/no-duplicate-sequence-flows': 'error',
    'bpmnlint/no-gateway-join-fork': 'warn',
    'bpmnlint/no-implicit-split': 'warn',
    'bpmnlint/no-implicit-end': 'warn',
    'bpmnlint/no-implicit-start': 'error',
    'bpmnlint/no-inclusive-gateway': 'warn',
    'bpmnlint/no-overlapping-elements': 'warn',
    'bpmnlint/single-blank-start-event': 'error',
    'bpmnlint/single-event-definition': 'error',
    'bpmnlint/start-event-required': 'error',
    'bpmnlint/sub-process-blank-start-event': 'error',
    'bpmnlint/superfluous-gateway': 'warn',
    'bpmnlint/superfluous-termination': 'warn',
    'sese/task-has-duration': 'error',
    'sese/task-has-impact': 'warn',
  }
}

export { resolver, config }
export default { resolver, config }
