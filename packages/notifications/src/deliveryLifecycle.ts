import {
    type DeliveryRunExceptionOutcome,
    DeliveryRunExceptionOutcomes,
    type DeliveryRunExceptionReason,
    DeliveryRunExceptionReasons,
} from '@gredice/storage';

export const deliveryLifecycleMilestones = [
    'route-started',
    'near-arrival',
    'next-stop',
    'delayed',
    'arrived',
    'delivered',
    'exception',
    'recovery',
] as const;

export type DeliveryLifecycleMilestone =
    (typeof deliveryLifecycleMilestones)[number];

export const deliveryLifecyclePreferenceCategory = 'delivery_updates';

export const deliveryLifecycleThresholds = {
    nearArrivalEnterSeconds: 30 * 60,
    delayEnterSeconds: 15 * 60,
    delayClearSeconds: 5 * 60,
} as const;

export const deliveryLifecycleRetentionPolicy = {
    auditAttemptsAndEventsDays: 180,
    notificationRows: 'existing-notification-retention-policy',
} as const;

type DeliveryLifecycleIdempotencyScope = 'request-run' | 'request-run-attempt';

type DeliveryLifecycleTrigger =
    | 'delivery-run-started'
    | 'route-eta-entered-near-window'
    | 'route-stop-became-next'
    | 'route-lateness-entered-delay-window'
    | 'stop-arrival-applied'
    | 'delivery-request-fulfilled'
    | 'stop-exception-applied'
    | 'stop-retry-opened';

export type DeliveryLifecyclePolicy = {
    idempotencyScope: DeliveryLifecycleIdempotencyScope;
    preferenceCategory: typeof deliveryLifecyclePreferenceCategory;
    quietHoursEligible: true;
    trigger: DeliveryLifecycleTrigger;
};

export const deliveryLifecyclePolicies = {
    'route-started': {
        idempotencyScope: 'request-run',
        preferenceCategory: deliveryLifecyclePreferenceCategory,
        quietHoursEligible: true,
        trigger: 'delivery-run-started',
    },
    'near-arrival': {
        idempotencyScope: 'request-run-attempt',
        preferenceCategory: deliveryLifecyclePreferenceCategory,
        quietHoursEligible: true,
        trigger: 'route-eta-entered-near-window',
    },
    'next-stop': {
        idempotencyScope: 'request-run-attempt',
        preferenceCategory: deliveryLifecyclePreferenceCategory,
        quietHoursEligible: true,
        trigger: 'route-stop-became-next',
    },
    delayed: {
        idempotencyScope: 'request-run-attempt',
        preferenceCategory: deliveryLifecyclePreferenceCategory,
        quietHoursEligible: true,
        trigger: 'route-lateness-entered-delay-window',
    },
    arrived: {
        idempotencyScope: 'request-run-attempt',
        preferenceCategory: deliveryLifecyclePreferenceCategory,
        quietHoursEligible: true,
        trigger: 'stop-arrival-applied',
    },
    delivered: {
        idempotencyScope: 'request-run',
        preferenceCategory: deliveryLifecyclePreferenceCategory,
        quietHoursEligible: true,
        trigger: 'delivery-request-fulfilled',
    },
    exception: {
        idempotencyScope: 'request-run-attempt',
        preferenceCategory: deliveryLifecyclePreferenceCategory,
        quietHoursEligible: true,
        trigger: 'stop-exception-applied',
    },
    recovery: {
        idempotencyScope: 'request-run-attempt',
        preferenceCategory: deliveryLifecyclePreferenceCategory,
        quietHoursEligible: true,
        trigger: 'stop-retry-opened',
    },
} as const satisfies Record<
    DeliveryLifecycleMilestone,
    DeliveryLifecyclePolicy
>;

export type DeliveryLifecycleContext = {
    accountId: string;
    requestId: string;
    runId: string;
    stopId: string;
};

export type DeliveryLifecycleSource = {
    id: string;
    kind:
        | 'run-state'
        | 'route-progress'
        | 'stop-operation'
        | 'exception-operation'
        | 'retry-state';
    version: number;
};

export const deliveryLifecycleSourceIdMaximumCharacters = 128;

export function isDeliveryLifecycleSourceId(value: string) {
    return (
        value.length > 0 &&
        value.length <= deliveryLifecycleSourceIdMaximumCharacters &&
        /^[A-Za-z0-9][A-Za-z0-9._:~-]*$/u.test(value)
    );
}

type DeliveryLifecycleObservationBase = {
    occurredAt: string;
    source: DeliveryLifecycleSource;
};

type DeliveryLifecycleAttemptObservationBase =
    DeliveryLifecycleObservationBase & {
        retryAttempt: number;
    };

export type DeliveryLifecycleObservation =
    | (DeliveryLifecycleObservationBase & {
          kind: 'route-started';
      })
    | (DeliveryLifecycleAttemptObservationBase & {
          etaMaxSeconds: number | null;
          kind: 'route-progress';
          lateBySeconds: number;
          stopsAhead: number;
      })
    | (DeliveryLifecycleAttemptObservationBase & {
          kind: 'arrived';
      })
    | (DeliveryLifecycleAttemptObservationBase & {
          kind: 'delivered';
      })
    | (DeliveryLifecycleAttemptObservationBase & {
          kind: 'exception';
          outcome: DeliveryRunExceptionOutcome;
          reason: DeliveryRunExceptionReason;
      })
    | (DeliveryLifecycleObservationBase & {
          kind: 'recovery';
          retryAttempt: number;
      });

type DeliveryLifecycleEventBase = DeliveryLifecycleContext & {
    eventVersion: 1;
    idempotencyKey: string;
    occurredAt: string;
    retryAttempt: number;
    source: DeliveryLifecycleSource;
};

export type DeliveryLifecycleEvent = DeliveryLifecycleEventBase &
    (
        | {
              milestone: Exclude<DeliveryLifecycleMilestone, 'exception'>;
          }
        | {
              exception: {
                  outcome: DeliveryRunExceptionOutcome;
                  reason: DeliveryRunExceptionReason;
              };
              milestone: 'exception';
          }
    );

type DeliveryLifecycleEventInputBase = {
    context: DeliveryLifecycleContext;
    occurredAt: string;
    retryAttempt: number;
    source: DeliveryLifecycleSource;
};

export type DeliveryLifecycleEventInput = DeliveryLifecycleEventInputBase &
    (
        | {
              exception?: never;
              milestone: Exclude<DeliveryLifecycleMilestone, 'exception'>;
          }
        | {
              exception: {
                  outcome: DeliveryRunExceptionOutcome;
                  reason: DeliveryRunExceptionReason;
              };
              milestone: 'exception';
          }
    );

export type DeliveryLifecycleState = {
    context: DeliveryLifecycleContext;
    delayActive: boolean;
    emittedIdempotencyKeys: string[];
    exceptionActive: boolean;
    lastStopsAhead: number | null;
    nearArrivalActive: boolean;
    retryAttempt: number;
    status: 'pending' | 'in-route' | 'arrived' | 'delivered';
};

function assertNonEmptyIdentifier(value: string, field: string) {
    if (value.trim().length === 0) {
        throw new Error(`${field} must be a non-empty identifier.`);
    }
}

function assertSafeInteger(value: number, field: string) {
    if (!Number.isSafeInteger(value) || value < 0) {
        throw new Error(`${field} must be a non-negative safe integer.`);
    }
}

function assertCanonicalTimestamp(value: string) {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime()) || parsed.toISOString() !== value) {
        throw new Error('occurredAt must be a canonical ISO timestamp.');
    }
}

function assertSource(source: DeliveryLifecycleSource) {
    assertNonEmptyIdentifier(source.id, 'source.id');
    if (!isDeliveryLifecycleSourceId(source.id)) {
        throw new Error(
            `source.id must be a bounded opaque identifier of at most ${deliveryLifecycleSourceIdMaximumCharacters} characters.`,
        );
    }
    assertSafeInteger(source.version, 'source.version');
}

function expectedSourceKind(
    observation: DeliveryLifecycleObservation,
): DeliveryLifecycleSource['kind'] {
    switch (observation.kind) {
        case 'route-started':
            return 'run-state';
        case 'route-progress':
            return 'route-progress';
        case 'arrived':
        case 'delivered':
            return 'stop-operation';
        case 'exception':
            return 'exception-operation';
        case 'recovery':
            return 'retry-state';
    }
}

function expectedSourceKindForMilestone(
    milestone: DeliveryLifecycleMilestone,
): DeliveryLifecycleSource['kind'] {
    switch (milestone) {
        case 'route-started':
            return 'run-state';
        case 'near-arrival':
        case 'next-stop':
        case 'delayed':
            return 'route-progress';
        case 'arrived':
        case 'delivered':
            return 'stop-operation';
        case 'exception':
            return 'exception-operation';
        case 'recovery':
            return 'retry-state';
    }
}

function assertBoundedException(exception: {
    outcome: DeliveryRunExceptionOutcome;
    reason: DeliveryRunExceptionReason;
}) {
    if (
        !Object.values(DeliveryRunExceptionOutcomes).includes(exception.outcome)
    ) {
        throw new Error('exception.outcome must be a bounded outcome.');
    }
    if (
        !Object.values(DeliveryRunExceptionReasons).includes(exception.reason)
    ) {
        throw new Error('exception.reason must be a bounded reason.');
    }
}

function encoded(value: string) {
    return encodeURIComponent(value);
}

export function deliveryLifecycleIdempotencyKey(
    context: DeliveryLifecycleContext,
    milestone: DeliveryLifecycleMilestone,
    retryAttempt: number,
) {
    assertDeliveryLifecycleContext(context);
    assertSafeInteger(retryAttempt, 'retryAttempt');
    const scope = deliveryLifecyclePolicies[milestone].idempotencyScope;
    const attempt =
        scope === 'request-run-attempt' ? String(retryAttempt) : 'all';
    return [
        'delivery-lifecycle',
        'v1',
        milestone,
        encoded(context.accountId),
        encoded(context.runId),
        encoded(context.stopId),
        encoded(context.requestId),
        attempt,
    ].join(':');
}

export function createDeliveryLifecycleEvent(
    input: DeliveryLifecycleEventInput,
): DeliveryLifecycleEvent {
    assertDeliveryLifecycleContext(input.context);
    assertCanonicalTimestamp(input.occurredAt);
    assertSafeInteger(input.retryAttempt, 'retryAttempt');
    assertSource(input.source);
    const requiredSourceKind = expectedSourceKindForMilestone(input.milestone);
    if (input.source.kind !== requiredSourceKind) {
        throw new Error(
            `${input.milestone} requires an authoritative ${requiredSourceKind} source.`,
        );
    }
    const base: DeliveryLifecycleEventBase = {
        ...input.context,
        eventVersion: 1,
        idempotencyKey: deliveryLifecycleIdempotencyKey(
            input.context,
            input.milestone,
            input.retryAttempt,
        ),
        occurredAt: input.occurredAt,
        retryAttempt: input.retryAttempt,
        source: { ...input.source },
    };
    if (input.milestone === 'exception') {
        assertBoundedException(input.exception);
        return {
            ...base,
            exception: { ...input.exception },
            milestone: input.milestone,
        };
    }
    return { ...base, milestone: input.milestone };
}

export function assertDeliveryLifecycleContext(
    context: DeliveryLifecycleContext,
) {
    assertNonEmptyIdentifier(context.accountId, 'accountId');
    assertNonEmptyIdentifier(context.requestId, 'requestId');
    assertNonEmptyIdentifier(context.runId, 'runId');
    assertNonEmptyIdentifier(context.stopId, 'stopId');
}

export function createDeliveryLifecycleState(
    context: DeliveryLifecycleContext,
): DeliveryLifecycleState {
    assertDeliveryLifecycleContext(context);
    return {
        context: { ...context },
        delayActive: false,
        emittedIdempotencyKeys: [],
        exceptionActive: false,
        lastStopsAhead: null,
        nearArrivalActive: false,
        retryAttempt: 0,
        status: 'pending',
    };
}

function validateObservation(observation: DeliveryLifecycleObservation) {
    assertCanonicalTimestamp(observation.occurredAt);
    assertSource(observation.source);
    if (observation.source.kind !== expectedSourceKind(observation)) {
        throw new Error(
            `${observation.kind} requires an authoritative ${expectedSourceKind(observation)} source.`,
        );
    }
    if (observation.kind === 'route-progress') {
        if (observation.etaMaxSeconds !== null) {
            assertSafeInteger(observation.etaMaxSeconds, 'etaMaxSeconds');
        }
        assertSafeInteger(observation.lateBySeconds, 'lateBySeconds');
        assertSafeInteger(observation.stopsAhead, 'stopsAhead');
    }
    if (observation.kind === 'exception') {
        assertBoundedException(observation);
    }
    if (observation.kind !== 'route-started') {
        assertSafeInteger(observation.retryAttempt, 'retryAttempt');
    }
}

function appendEvent(
    state: DeliveryLifecycleState,
    observation: DeliveryLifecycleObservation,
    milestone: DeliveryLifecycleMilestone,
    exception?: {
        outcome: DeliveryRunExceptionOutcome;
        reason: DeliveryRunExceptionReason;
    },
) {
    const idempotencyKey = deliveryLifecycleIdempotencyKey(
        state.context,
        milestone,
        state.retryAttempt,
    );
    if (state.emittedIdempotencyKeys.includes(idempotencyKey)) {
        return null;
    }
    state.emittedIdempotencyKeys.push(idempotencyKey);
    const base: DeliveryLifecycleEventBase = {
        ...state.context,
        eventVersion: 1,
        idempotencyKey,
        occurredAt: observation.occurredAt,
        retryAttempt: state.retryAttempt,
        source: { ...observation.source },
    };
    if (milestone === 'exception') {
        if (!exception) {
            throw new Error('Exception milestone requires a bounded outcome.');
        }
        return { ...base, exception, milestone };
    }
    return { ...base, milestone };
}

export function applyDeliveryLifecycleObservation(
    currentState: DeliveryLifecycleState,
    observation: DeliveryLifecycleObservation,
): {
    events: DeliveryLifecycleEvent[];
    state: DeliveryLifecycleState;
} {
    validateObservation(observation);
    const state: DeliveryLifecycleState = {
        ...currentState,
        context: { ...currentState.context },
        emittedIdempotencyKeys: [...currentState.emittedIdempotencyKeys],
    };
    assertDeliveryLifecycleContext(state.context);
    const events: DeliveryLifecycleEvent[] = [];
    const emit = (
        milestone: DeliveryLifecycleMilestone,
        exception?: {
            outcome: DeliveryRunExceptionOutcome;
            reason: DeliveryRunExceptionReason;
        },
    ) => {
        const event = appendEvent(state, observation, milestone, exception);
        if (event) events.push(event);
    };

    if (observation.kind === 'route-started') {
        if (state.status === 'pending') {
            state.status = 'in-route';
            emit('route-started');
        }
        return { events, state };
    }

    if (
        observation.kind !== 'recovery' &&
        observation.retryAttempt !== state.retryAttempt
    ) {
        return { events, state };
    }

    if (observation.kind === 'route-progress') {
        if (state.status !== 'in-route' || state.exceptionActive) {
            return { events, state };
        }
        if (
            !state.nearArrivalActive &&
            observation.etaMaxSeconds !== null &&
            observation.etaMaxSeconds <=
                deliveryLifecycleThresholds.nearArrivalEnterSeconds
        ) {
            state.nearArrivalActive = true;
            emit('near-arrival');
        }
        if (observation.stopsAhead === 0 && state.lastStopsAhead !== 0) {
            emit('next-stop');
        }
        state.lastStopsAhead = observation.stopsAhead;
        if (
            state.delayActive &&
            observation.lateBySeconds <=
                deliveryLifecycleThresholds.delayClearSeconds
        ) {
            state.delayActive = false;
        }
        if (
            !state.delayActive &&
            observation.lateBySeconds >=
                deliveryLifecycleThresholds.delayEnterSeconds
        ) {
            state.delayActive = true;
            emit('delayed');
        }
        return { events, state };
    }

    if (observation.kind === 'arrived') {
        if (state.status === 'in-route' && !state.exceptionActive) {
            state.status = 'arrived';
            emit('arrived');
        }
        return { events, state };
    }

    if (observation.kind === 'delivered') {
        if (state.status === 'arrived' && !state.exceptionActive) {
            state.status = 'delivered';
            emit('delivered');
        }
        return { events, state };
    }

    if (observation.kind === 'exception') {
        if (
            state.status !== 'pending' &&
            state.status !== 'delivered' &&
            !state.exceptionActive
        ) {
            state.exceptionActive = true;
            emit('exception', {
                outcome: observation.outcome,
                reason: observation.reason,
            });
        }
        return { events, state };
    }

    if (
        state.exceptionActive &&
        observation.retryAttempt === state.retryAttempt + 1 &&
        state.status !== 'delivered'
    ) {
        state.retryAttempt = observation.retryAttempt;
        state.exceptionActive = false;
        state.delayActive = false;
        state.lastStopsAhead = null;
        state.nearArrivalActive = false;
        if (state.status === 'arrived') state.status = 'in-route';
        emit('recovery');
    }
    return { events, state };
}
