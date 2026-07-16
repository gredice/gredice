import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
    applyDeliveryLifecycleObservation,
    createDeliveryLifecycleEvent,
    createDeliveryLifecycleState,
    type DeliveryLifecycleContext,
    type DeliveryLifecycleObservation,
    type DeliveryLifecycleSource,
    type DeliveryLifecycleState,
    deliveryLifecycleIdempotencyKey,
    deliveryLifecycleMilestones,
    deliveryLifecyclePolicies,
    deliveryLifecyclePreferenceCategory,
    deliveryLifecycleRetentionPolicy,
    deliveryLifecycleSourceIdMaximumCharacters,
    deliveryLifecycleThresholds,
    isDeliveryLifecycleSourceId,
} from './deliveryLifecycle';

const context: DeliveryLifecycleContext = {
    accountId: 'account:1',
    requestId: 'request:1',
    runId: 'run:1',
    stopId: 'stop:1',
};

const occurredAt = '2026-07-16T10:00:00.000Z';

type ObservationInput<T> = T extends DeliveryLifecycleObservation
    ? Omit<T, 'occurredAt' | 'source'>
    : never;

type DeliveryLifecycleObservationInput =
    ObservationInput<DeliveryLifecycleObservation>;

function observation(
    value: DeliveryLifecycleObservationInput,
): DeliveryLifecycleObservation {
    const sourceKind: DeliveryLifecycleSource['kind'] = (() => {
        switch (value.kind) {
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
    })();
    const source: DeliveryLifecycleSource = {
        id: 'domain-operation-1',
        kind: sourceKind,
        version: 1,
    };
    const result = {
        ...value,
        occurredAt,
        source,
    };
    return result;
}

function apply(
    state: DeliveryLifecycleState,
    value: DeliveryLifecycleObservationInput,
) {
    return applyDeliveryLifecycleObservation(state, observation(value));
}

describe('delivery lifecycle contract', () => {
    test('defines every milestone, authoritative trigger, preference, and retention policy', () => {
        assert.deepEqual(deliveryLifecycleMilestones, [
            'route-started',
            'near-arrival',
            'next-stop',
            'delayed',
            'arrived',
            'delivered',
            'exception',
            'recovery',
        ]);
        for (const milestone of deliveryLifecycleMilestones) {
            const policy = deliveryLifecyclePolicies[milestone];
            assert.ok(policy.trigger.length > 0);
            assert.equal(
                policy.preferenceCategory,
                deliveryLifecyclePreferenceCategory,
            );
            assert.equal(policy.quietHoursEligible, true);
        }
        assert.deepEqual(deliveryLifecycleRetentionPolicy, {
            auditAttemptsAndEventsDays: 180,
            notificationRows: 'existing-notification-retention-policy',
        });
    });

    test('uses stable request keys without volatile ETA or source revisions', () => {
        const first = deliveryLifecycleIdempotencyKey(
            context,
            'near-arrival',
            0,
        );
        const replay = deliveryLifecycleIdempotencyKey(
            context,
            'near-arrival',
            0,
        );
        const retry = deliveryLifecycleIdempotencyKey(
            context,
            'near-arrival',
            1,
        );
        assert.equal(first, replay);
        assert.notEqual(first, retry);
        assert.doesNotMatch(first, /eta|source|revision/i);
        assert.equal(
            deliveryLifecycleIdempotencyKey(context, 'route-started', 0),
            deliveryLifecycleIdempotencyKey(context, 'route-started', 4),
        );
        assert.equal(
            deliveryLifecycleIdempotencyKey(context, 'delivered', 0),
            deliveryLifecycleIdempotencyKey(context, 'delivered', 4),
        );
    });

    test('recognizes only bounded opaque lifecycle source identifiers', () => {
        assert.equal(isDeliveryLifecycleSourceId('legacy-operation:1_2'), true);
        assert.equal(
            isDeliveryLifecycleSourceId(
                'x'.repeat(deliveryLifecycleSourceIdMaximumCharacters),
            ),
            true,
        );
        for (const invalid of [
            '',
            'operation with spaces',
            'operation/with/slash',
            'operacija-žetva',
            'x'.repeat(deliveryLifecycleSourceIdMaximumCharacters + 1),
        ]) {
            assert.equal(isDeliveryLifecycleSourceId(invalid), false);
        }
    });

    test('creates validated events directly from authoritative durable milestones', () => {
        const first = createDeliveryLifecycleEvent({
            context,
            milestone: 'arrived',
            occurredAt,
            retryAttempt: 2,
            source: {
                id: 'stop-operation:42',
                kind: 'stop-operation',
                version: 7,
            },
        });
        const replay = createDeliveryLifecycleEvent({
            context,
            milestone: 'arrived',
            occurredAt: '2026-07-16T10:01:00.000Z',
            retryAttempt: 2,
            source: {
                id: 'stop-operation:42-replay',
                kind: 'stop-operation',
                version: 8,
            },
        });
        assert.equal(first.idempotencyKey, replay.idempotencyKey);
        assert.equal(first.milestone, 'arrived');
        assert.equal(first.retryAttempt, 2);

        const exception = createDeliveryLifecycleEvent({
            context,
            exception: {
                outcome: 'deferred',
                reason: 'customer-unavailable',
            },
            milestone: 'exception',
            occurredAt,
            retryAttempt: 2,
            source: {
                id: 'exception-operation:42',
                kind: 'exception-operation',
                version: 1,
            },
        });
        assert.equal(exception.milestone, 'exception');
        assert.deepEqual(exception.exception, {
            outcome: 'deferred',
            reason: 'customer-unavailable',
        });

        assert.throws(
            () =>
                createDeliveryLifecycleEvent({
                    context,
                    milestone: 'delayed',
                    occurredAt,
                    retryAttempt: 0,
                    source: {
                        id: 'wrong-source',
                        kind: 'stop-operation',
                        version: 1,
                    },
                }),
            /authoritative route-progress source/,
        );
    });

    test('enforces event ordering and emits threshold milestones in canonical order', () => {
        let state = createDeliveryLifecycleState(context);
        let result = apply(state, {
            kind: 'route-progress',
            etaMaxSeconds: 60,
            lateBySeconds: 2_000,
            retryAttempt: 0,
            stopsAhead: 0,
        });
        assert.deepEqual(result.events, []);

        result = apply(result.state, { kind: 'route-started' });
        assert.deepEqual(
            result.events.map((event) => event.milestone),
            ['route-started'],
        );
        state = result.state;

        result = apply(state, {
            kind: 'route-progress',
            etaMaxSeconds: deliveryLifecycleThresholds.nearArrivalEnterSeconds,
            lateBySeconds: deliveryLifecycleThresholds.delayEnterSeconds,
            retryAttempt: 0,
            stopsAhead: 0,
        });
        assert.deepEqual(
            result.events.map((event) => event.milestone),
            ['near-arrival', 'next-stop', 'delayed'],
        );
        state = result.state;

        result = apply(state, {
            kind: 'route-progress',
            etaMaxSeconds:
                deliveryLifecycleThresholds.nearArrivalEnterSeconds + 90,
            lateBySeconds: deliveryLifecycleThresholds.delayEnterSeconds - 1,
            retryAttempt: 0,
            stopsAhead: 1,
        });
        assert.deepEqual(result.events, []);
        result = apply(result.state, {
            kind: 'route-progress',
            etaMaxSeconds:
                deliveryLifecycleThresholds.nearArrivalEnterSeconds - 90,
            lateBySeconds: deliveryLifecycleThresholds.delayEnterSeconds + 1,
            retryAttempt: 0,
            stopsAhead: 0,
        });
        assert.deepEqual(result.events, []);

        result = apply(result.state, {
            kind: 'route-progress',
            etaMaxSeconds: 60,
            lateBySeconds: deliveryLifecycleThresholds.delayClearSeconds,
            retryAttempt: 0,
            stopsAhead: 0,
        });
        assert.deepEqual(result.events, []);
        result = apply(result.state, {
            kind: 'route-progress',
            etaMaxSeconds: 60,
            lateBySeconds: deliveryLifecycleThresholds.delayEnterSeconds,
            retryAttempt: 0,
            stopsAhead: 0,
        });
        assert.deepEqual(result.events, []);

        result = apply(result.state, { kind: 'delivered', retryAttempt: 0 });
        assert.deepEqual(result.events, []);
        result = apply(result.state, { kind: 'arrived', retryAttempt: 0 });
        assert.deepEqual(
            result.events.map((event) => event.milestone),
            ['arrived'],
        );
        result = apply(result.state, { kind: 'delivered', retryAttempt: 0 });
        assert.deepEqual(
            result.events.map((event) => event.milestone),
            ['delivered'],
        );
        result = apply(result.state, {
            kind: 'route-progress',
            etaMaxSeconds: 1,
            lateBySeconds: 9_999,
            retryAttempt: 0,
            stopsAhead: 0,
        });
        assert.deepEqual(result.events, []);
    });

    test('opens one new milestone scope only after an exception recovery attempt', () => {
        let result = apply(createDeliveryLifecycleState(context), {
            kind: 'route-started',
        });
        const firstAttemptProgress = observation({
            kind: 'route-progress',
            etaMaxSeconds: 300,
            lateBySeconds: 1_000,
            retryAttempt: 0,
            stopsAhead: 0,
        });
        result = applyDeliveryLifecycleObservation(
            result.state,
            firstAttemptProgress,
        );
        const firstAttemptKeys = result.events.map(
            (event) => event.idempotencyKey,
        );
        result = apply(result.state, {
            kind: 'exception',
            outcome: 'deferred',
            reason: 'customer-unavailable',
            retryAttempt: 0,
        });
        const exceptionEvent = result.events[0];
        assert.ok(exceptionEvent);
        if (exceptionEvent.milestone !== 'exception') {
            assert.fail('Expected an exception event.');
        }
        assert.deepEqual(exceptionEvent.exception, {
            outcome: 'deferred',
            reason: 'customer-unavailable',
        });
        result = apply(result.state, {
            kind: 'exception',
            outcome: 'deferred',
            reason: 'customer-unavailable',
            retryAttempt: 0,
        });
        assert.deepEqual(result.events, []);
        result = apply(result.state, { kind: 'recovery', retryAttempt: 1 });
        assert.equal(result.events[0]?.milestone, 'recovery');
        result = applyDeliveryLifecycleObservation(
            result.state,
            firstAttemptProgress,
        );
        assert.deepEqual(result.events, []);
        result = apply(result.state, {
            kind: 'route-progress',
            etaMaxSeconds: 300,
            lateBySeconds: 1_000,
            retryAttempt: 1,
            stopsAhead: 0,
        });
        assert.deepEqual(
            result.events.map((event) => event.milestone),
            ['near-arrival', 'next-stop', 'delayed'],
        );
        assert.equal(
            result.events.some((event) =>
                firstAttemptKeys.includes(event.idempotencyKey),
            ),
            false,
        );
    });

    test('keeps customer events minimal and free of address, coordinate, and contact data', () => {
        let result = apply(createDeliveryLifecycleState(context), {
            kind: 'route-started',
        });
        result = apply(result.state, {
            kind: 'exception',
            outcome: 'failed',
            reason: 'address-inaccessible',
            retryAttempt: 0,
        });
        const event = result.events[0];
        assert.ok(event);
        if (event.milestone !== 'exception') {
            assert.fail('Expected an exception event.');
        }
        assert.deepEqual(Object.keys(event).sort(), [
            'accountId',
            'eventVersion',
            'exception',
            'idempotencyKey',
            'milestone',
            'occurredAt',
            'requestId',
            'retryAttempt',
            'runId',
            'source',
            'stopId',
        ]);
        const payloadFieldNames = [
            ...Object.keys(event),
            ...Object.keys(event.source),
            ...Object.keys(event.exception),
        ];
        for (const forbiddenField of [
            'address',
            'coordinates',
            'latitude',
            'longitude',
            'email',
            'phone',
            'customerId',
            'driverId',
            'userId',
        ]) {
            assert.equal(payloadFieldNames.includes(forbiddenField), false);
        }
    });

    test('rejects malformed identifiers, timestamps, revisions, and route metrics', () => {
        assert.throws(
            () => createDeliveryLifecycleState({ ...context, requestId: ' ' }),
            /requestId/,
        );
        const state = createDeliveryLifecycleState(context);
        assert.throws(
            () =>
                applyDeliveryLifecycleObservation(state, {
                    ...observation({ kind: 'route-started' }),
                    occurredAt: '2026-07-16',
                }),
            /canonical ISO timestamp/,
        );
        assert.throws(
            () =>
                applyDeliveryLifecycleObservation(state, {
                    ...observation({ kind: 'route-started' }),
                    source: {
                        id: 'operation',
                        kind: 'run-state',
                        version: -1,
                    },
                }),
            /source.version/,
        );
        assert.throws(
            () =>
                applyDeliveryLifecycleObservation(state, {
                    ...observation({ kind: 'route-started' }),
                    source: {
                        id: `operation-${'x'.repeat(119)}`,
                        kind: 'run-state',
                        version: 1,
                    },
                }),
            /source.id must be a bounded opaque identifier of at most 128 characters/,
        );
        assert.throws(
            () =>
                applyDeliveryLifecycleObservation(state, {
                    ...observation({ kind: 'route-started' }),
                    source: {
                        id: 'operation',
                        kind: 'stop-operation',
                        version: 1,
                    },
                }),
            /authoritative run-state source/,
        );
        const validException = observation({
            kind: 'exception',
            outcome: 'failed',
            reason: 'operational-other',
            retryAttempt: 0,
        });
        assert.throws(
            () =>
                Reflect.apply(applyDeliveryLifecycleObservation, undefined, [
                    state,
                    { ...validException, outcome: 'unbounded-outcome' },
                ]),
            /bounded outcome/,
        );
        assert.throws(
            () =>
                Reflect.apply(applyDeliveryLifecycleObservation, undefined, [
                    state,
                    { ...validException, reason: 'unbounded-reason' },
                ]),
            /bounded reason/,
        );
        assert.throws(
            () =>
                apply(state, {
                    kind: 'route-progress',
                    etaMaxSeconds: -1,
                    lateBySeconds: 0,
                    retryAttempt: 0,
                    stopsAhead: 0,
                }),
            /etaMaxSeconds/,
        );
    });
});
