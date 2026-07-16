import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import {
    type DeliveryOperationalRunSample,
    deliveryOperationalDelayedReplayMs,
    deliveryOperationalExceptionSamplesFromProjection,
    deliveryOperationalStaleRerouteMs,
    deliveryOperationalStalledRunMs,
    deliveryRunExceptionOperations,
    deliveryRuns,
    getDeliveryOperationalHealth,
    pickupLocations,
    projectDeliveryOperationalHealth,
    storage,
    timeSlots,
    users,
} from '@gredice/storage';
import { createTestDb } from './testDb';

const now = new Date('2046-07-17T12:00:00.000Z');
const from = new Date(now.getTime() - 24 * 60 * 60 * 1000);

function runSample(
    id: string,
    values: Partial<DeliveryOperationalRunSample> = {},
): DeliveryOperationalRunSample {
    return {
        completedAt: null,
        currentLocationReceivedAt: new Date(now.getTime() - 10_000),
        estimateSource: 'google',
        estimatesUpdatedAt: new Date(now.getTime() - 10_000),
        id,
        rerouteAttemptedAt: null,
        rerouteRequiredAt: null,
        routePlanVersion: 2,
        startedAt: new Date(now.getTime() - 30 * 60 * 1000),
        state: 'active',
        updatedAt: new Date(now.getTime() - 10_000),
        ...values,
    };
}

test('projects route, tracking, reroute, exception, abandonment, and delayed replay health without private payloads', () => {
    const privateValue = 'PRIVATE CUSTOMER ADDRESS 45.8, 15.9';
    const health = projectDeliveryOperationalHealth({
        diagnosticLimit: 100,
        exceptionSamples: [
            {
                occurredAt: new Date(now.getTime() - 15_000),
                outcome: 'failed',
                reason: 'address-inaccessible',
                runId: privateValue,
            },
            {
                occurredAt: new Date(now.getTime() - 10_000),
                outcome: 'failed',
                reason: 'address-inaccessible',
                runId: privateValue,
            },
        ],
        from,
        now,
        replaySamples: [
            {
                appliedAt: now,
                kind: 'stop',
                occurredAt: new Date(
                    now.getTime() - deliveryOperationalDelayedReplayMs,
                ),
                runId: 'run-replay',
            },
        ],
        runSamples: [
            runSample(privateValue, {
                currentLocationReceivedAt: new Date(
                    now.getTime() - deliveryOperationalStalledRunMs,
                ),
                estimateSource: 'local',
                estimatesUpdatedAt: new Date(
                    now.getTime() - deliveryOperationalStalledRunMs,
                ),
                rerouteAttemptedAt: new Date(
                    now.getTime() - deliveryOperationalStaleRerouteMs,
                ),
                rerouteRequiredAt: new Date(
                    now.getTime() - deliveryOperationalStaleRerouteMs,
                ),
                startedAt: new Date(
                    now.getTime() - deliveryOperationalStalledRunMs * 2,
                ),
                updatedAt: new Date(
                    now.getTime() - deliveryOperationalStalledRunMs,
                ),
            }),
            runSample('run-completed-1', {
                completedAt: new Date(now.getTime() - 20_000),
                state: 'completed',
            }),
            runSample('run-completed-2', {
                completedAt: new Date(now.getTime() - 30_000),
                state: 'completed',
            }),
            runSample('run-abandoned', {
                completedAt: new Date(now.getTime() - 40_000),
                state: 'cancelled',
            }),
        ],
        to: now,
    });

    assert.equal(health.severity, 'critical');
    assert.deepEqual(health.alerts, {
        delayedOfflineReplay: true,
        elevatedLocalFallback: true,
        staleReroute: true,
        stalledRun: true,
        trackingUnavailable: true,
    });
    assert.deepEqual(health.runs, {
        abandonedCount: 1,
        activeCount: 1,
        completedCount: 2,
        localFallbackCount: 1,
        localFallbackRate: 0.25,
        modernPlanCount: 4,
        stalledCount: 1,
    });
    assert.deepEqual(health.tracking, {
        delayedCount: 0,
        liveCount: 0,
        notReceivedCount: 0,
        unavailableCount: 1,
    });
    assert.equal(health.reroutes.pendingCount, 1);
    assert.equal(health.reroutes.staleCount, 1);
    assert.equal(health.actions.delayedReplayCount, 1);
    assert.equal(
        health.actions.maximumReplayDelayMs,
        deliveryOperationalDelayedReplayMs,
    );
    assert.deepEqual(health.exceptions, [
        {
            count: 2,
            outcome: 'failed',
            reason: 'address-inaccessible',
        },
    ]);
    assert.ok(
        health.diagnostics.items.some(
            (item) => item.kind === 'exception-outcome' && item.count === 2,
        ),
    );
    assert.ok(
        health.diagnostics.items.some(
            (item) => item.runId === 'run-id-unavailable',
        ),
    );
    assert.ok(
        health.diagnostics.items.every(
            (item) =>
                Object.keys(item).sort().join(',') ===
                [
                    ...(item.ageMs === undefined ? [] : ['ageMs']),
                    'count',
                    'kind',
                    'occurredAt',
                    'reasonCode',
                    'runId',
                    'severity',
                ]
                    .sort()
                    .join(','),
        ),
    );
    assert.doesNotMatch(JSON.stringify(health), new RegExp(privateValue));
});

test('keeps a newly started run without a location below alert thresholds', () => {
    const health = projectDeliveryOperationalHealth({
        exceptionSamples: [],
        from,
        now,
        replaySamples: [],
        runSamples: [
            runSample('run-new', {
                currentLocationReceivedAt: null,
                startedAt: new Date(now.getTime() - 10_000),
                updatedAt: new Date(now.getTime() - 10_000),
            }),
        ],
        to: now,
    });

    assert.equal(health.severity, 'healthy');
    assert.equal(health.tracking.notReceivedCount, 1);
    assert.equal(health.alerts.trackingUnavailable, false);
    assert.deepEqual(health.diagnostics.items, []);
});

test('timestamps persisted local fallback diagnostics from the estimate update', () => {
    const estimatesUpdatedAt = new Date(now.getTime() - 5 * 60 * 1000);
    const health = projectDeliveryOperationalHealth({
        exceptionSamples: [],
        from,
        now,
        replaySamples: [],
        runSamples: [
            runSample('run-local-fallback', {
                completedAt: new Date(now.getTime() - 60_000),
                estimateSource: 'local',
                estimatesUpdatedAt,
                state: 'completed',
            }),
        ],
        to: now,
    });

    const fallback = health.diagnostics.items.find(
        (item) => item.kind === 'local-route-fallback',
    );
    assert.equal(fallback?.occurredAt, estimatesUpdatedAt);
});

test('treats a freshly applied operation receipt as run activity even when GPS and run timestamps are stale', () => {
    const runId = 'run-receipt-active';
    const health = projectDeliveryOperationalHealth({
        exceptionSamples: [],
        from,
        now,
        replaySamples: [
            {
                appliedAt: new Date(now.getTime() - 10_000),
                kind: 'stop',
                occurredAt: new Date(now.getTime() - 10_000),
                runId,
            },
        ],
        runSamples: [
            runSample(runId, {
                currentLocationReceivedAt: new Date(
                    now.getTime() - deliveryOperationalStalledRunMs * 2,
                ),
                estimatesUpdatedAt: new Date(
                    now.getTime() - deliveryOperationalStalledRunMs * 2,
                ),
                startedAt: new Date(
                    now.getTime() - deliveryOperationalStalledRunMs * 2,
                ),
                updatedAt: new Date(
                    now.getTime() - deliveryOperationalStalledRunMs * 2,
                ),
            }),
        ],
        to: now,
    });

    assert.equal(health.alerts.trackingUnavailable, true);
    assert.equal(health.alerts.stalledRun, false);
    assert.equal(health.runs.stalledCount, 0);
    assert.equal(
        health.diagnostics.items.some((item) => item.kind === 'run-stalled'),
        false,
    );
});

test('parses only bounded exception outcome data from immutable operation receipts', () => {
    const privateValue = 'Private Street 12 and customer phone 0991234567';
    const samples = deliveryOperationalExceptionSamplesFromProjection({
        occurredAt: now,
        outcomes: [
            {
                deliveryRequestId: privateValue,
                note: privateValue,
                outcome: 'failed',
                reason: 'harvest-missing',
                stopId: 41,
            },
            {
                outcome: 'unknown-private-outcome',
                reason: 'operational-other',
            },
        ],
        runId: 'run-recovered',
    });

    assert.deepEqual(samples, [
        {
            occurredAt: now,
            outcome: 'failed',
            reason: 'harvest-missing',
            runId: 'run-recovered',
        },
    ]);
    assert.doesNotMatch(JSON.stringify(samples), new RegExp(privateValue));
});

test('bounds diagnostics and rejects invalid diagnostic limits', () => {
    const input = {
        exceptionSamples: [],
        from,
        now,
        replaySamples: [],
        runSamples: Array.from({ length: 220 }, (_, index) =>
            runSample(`run-${index.toString().padStart(3, '0')}`, {
                completedAt: new Date(now.getTime() - index * 1_000),
                estimateSource: 'local',
                state: 'cancelled',
            }),
        ),
        to: now,
    };

    const health = projectDeliveryOperationalHealth({
        ...input,
        diagnosticLimit: 500,
    });
    assert.equal(health.diagnostics.items.length, 200);
    assert.equal(health.diagnostics.truncated, true);
    assert.throws(
        () =>
            projectDeliveryOperationalHealth({
                ...input,
                diagnosticLimit: 0,
            }),
        /positive integer/u,
    );
});

test('keeps older critical and warning diagnostics ahead of newer info when the list is capped', () => {
    const health = projectDeliveryOperationalHealth({
        diagnosticLimit: 200,
        exceptionSamples: [],
        from,
        now,
        replaySamples: [],
        runSamples: [
            runSample('run-critical', {
                rerouteRequiredAt: new Date(
                    now.getTime() - deliveryOperationalStaleRerouteMs,
                ),
            }),
            runSample('run-warning', {
                currentLocationReceivedAt: new Date(now.getTime() - 60_000),
            }),
            ...Array.from({ length: 220 }, (_, index) =>
                runSample(`run-info-${index.toString().padStart(3, '0')}`, {
                    completedAt: new Date(now.getTime() - index * 1_000),
                    state: 'cancelled',
                }),
            ),
        ],
        to: now,
    });

    assert.equal(health.diagnostics.items.length, 200);
    assert.equal(health.diagnostics.truncated, true);
    assert.equal(health.diagnostics.items[0]?.kind, 'reroute-stale');
    assert.equal(health.diagnostics.items[0]?.severity, 'critical');
    assert.equal(health.diagnostics.items[1]?.kind, 'tracking-delayed');
    assert.equal(health.diagnostics.items[1]?.severity, 'warning');
    assert.ok(
        health.diagnostics.items
            .slice(2)
            .every((item) => item.severity === 'info'),
    );
});

test('queries an empty operational window through the real storage schema', async () => {
    createTestDb();
    const health = await getDeliveryOperationalHealth({ from, now, to: now });

    assert.equal(health.severity, 'healthy');
    assert.equal(health.runs.activeCount, 0);
    assert.deepEqual(health.diagnostics, { items: [], truncated: false });
});

test('rejects invalid and unbounded operational windows before reading storage', async () => {
    await assert.rejects(
        getDeliveryOperationalHealth({
            from: now,
            now,
            to: new Date(now.getTime() - 1),
        }),
        /from must be before/u,
    );
    await assert.rejects(
        getDeliveryOperationalHealth({
            from: new Date(now.getTime() - 31 * 24 * 60 * 60 * 1000),
            now,
            to: now,
        }),
        /cannot exceed 30 days/u,
    );
    await assert.rejects(
        getDeliveryOperationalHealth({ now: new Date('invalid') }),
        /now must be a valid date/u,
    );
});

test('maps an active route and retains a recovered exception from its immutable receipt', async () => {
    createTestDb();
    const driverUserId = randomUUID();
    await storage()
        .insert(users)
        .values({
            id: driverUserId,
            userName: `driver-${driverUserId}@example.test`,
            displayName: 'Private Driver Name',
            role: 'driver',
        });
    const [pickupLocation] = await storage()
        .insert(pickupLocations)
        .values({
            city: 'Private City',
            countryCode: 'HR',
            name: 'Private HQ',
            postalCode: '10000',
            street1: 'Private Street 12',
        })
        .returning({ id: pickupLocations.id });
    assert.ok(pickupLocation);
    const [timeSlot] = await storage()
        .insert(timeSlots)
        .values({
            endAt: new Date(now.getTime() + 60 * 60 * 1000),
            locationId: pickupLocation.id,
            startAt: new Date(now.getTime() - 60 * 60 * 1000),
            type: 'delivery',
        })
        .returning({ id: timeSlots.id });
    assert.ok(timeSlot);
    const runId = randomUUID();
    await storage()
        .insert(deliveryRuns)
        .values({
            currentLocationReceivedAt: new Date(now.getTime() - 10_000),
            driverUserId,
            estimateSource: 'local',
            id: runId,
            routePlanVersion: 2,
            startedAt: new Date(now.getTime() - 10 * 60 * 1000),
            timeSlotId: timeSlot.id,
            updatedAt: new Date(now.getTime() - 10_000),
        });
    await storage()
        .insert(deliveryRunExceptionOperations)
        .values({
            appliedAt: new Date(now.getTime() - 5_000),
            clientOperationId: `exception-${randomUUID()}`,
            driverUserId,
            occurredAt: new Date(now.getTime() - 10_000),
            payloadHash: 'private-payload-digest',
            result: {
                outcomes: [
                    {
                        deliveryRequestId: 'private-request-id',
                        outcome: 'failed',
                        reason: 'harvest-missing',
                        retryAttempt: 0,
                        stopId: 123,
                    },
                ],
                reroutePending: false,
                routeRevision: 2,
                runCompleted: false,
            },
            runId,
        });
    await storage()
        .insert(deliveryRunExceptionOperations)
        .values({
            appliedAt: new Date(now.getTime() - 4_000),
            clientOperationId: `exception-oversized-${randomUUID()}`,
            driverUserId,
            occurredAt: new Date(now.getTime() - 9_000),
            payloadHash: 'second-private-payload-digest',
            result: {
                outcomes: Array.from({ length: 201 }, (_, index) => ({
                    deliveryRequestId: `private-oversized-request-${index}`,
                    outcome: 'failed' as const,
                    reason: 'address-inaccessible' as const,
                    retryAttempt: 0,
                    stopId: index + 1,
                })),
                reroutePending: false,
                routeRevision: 2,
                runCompleted: false,
            },
            runId,
        });

    const health = await getDeliveryOperationalHealth({ from, now, to: now });

    assert.equal(health.severity, 'healthy');
    assert.equal(health.runs.activeCount, 1);
    assert.equal(health.runs.localFallbackCount, 1);
    assert.equal(health.tracking.liveCount, 1);
    assert.deepEqual(health.exceptions, [
        { count: 1, outcome: 'failed', reason: 'harvest-missing' },
    ]);
    assert.doesNotMatch(
        JSON.stringify(health),
        /Private Driver|Private Street|Private City|Private HQ|private-request-id|private-payload-digest|private-oversized/u,
    );
});
