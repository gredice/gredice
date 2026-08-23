import assert from 'node:assert/strict';
import test from 'node:test';
import {
    deliveryRunExactLocationTtlMs,
    deliveryRunTrackingLiveThresholdMs,
} from '@gredice/storage';
import {
    classifyDriverLocationResponse,
    type DriverLocationSample,
    DriverTrackingController,
    driverLocationSampleIsExpired,
    driverTrackingLiveThresholdMs,
    driverTrackingMaximumRetryDelayMs,
    driverTrackingMinimumAttemptIntervalMs,
    driverTrackingNextAttemptAt,
    driverTrackingRetryDelayMs,
    driverTrackingSampleTtlMs,
    driverTrackingServerSeedIsNewer,
    driverTrackingStatusAfterElapsed,
    driverTrackingUploadTimeoutMs,
    initialDriverTrackingViewState,
    parseDriverLocationAcknowledgement,
    parseDriverTrackingServerSeed,
    parseRetryAfterMs,
    selectNewestDriverLocationSample,
} from './driverTracking';

function sample(
    recordedAtMs: number,
    overrides: Partial<DriverLocationSample> = {},
): DriverLocationSample {
    return {
        latitude: 45.81,
        longitude: 15.98,
        accuracy: 8,
        heading: 90,
        speed: 6,
        recordedAt: new Date(recordedAtMs).toISOString(),
        recordedAtMs,
        observedAtMonotonicMs: 1_000,
        expiresAtMonotonicMs: 1_000 + driverTrackingSampleTtlMs,
        observedAtWallMs: 1_000,
        expiresAtWallMs: 1_000 + driverTrackingSampleTtlMs,
        ...overrides,
    };
}

test('client freshness and TTL thresholds stay aligned with the server contract', () => {
    assert.equal(
        driverTrackingLiveThresholdMs,
        deliveryRunTrackingLiveThresholdMs,
    );
    assert.equal(driverTrackingSampleTtlMs, deliveryRunExactLocationTtlMs);
});

test('only a complete server acknowledgement can establish an accepted location', () => {
    const acknowledged = parseDriverLocationAcknowledgement({
        status: 'live',
        acceptedAt: '2026-07-15T12:00:00.000Z',
        refreshedAt: '2026-07-15T12:00:01.000Z',
        replayed: false,
    });
    assert.deepEqual(acknowledged, {
        status: 'live',
        acceptedAt: '2026-07-15T12:00:00.000Z',
        refreshedAt: '2026-07-15T12:00:01.000Z',
        replayed: false,
    });
    assert.equal(
        parseDriverLocationAcknowledgement({
            status: 'live',
            acceptedAt: 'not-a-date',
            refreshedAt: '2026-07-15T12:00:01.000Z',
            replayed: false,
        }),
        null,
    );
    assert.equal(
        parseDriverLocationAcknowledgement({
            status: 'live',
            acceptedAt: '2026-07-15T12:00:00.000Z',
            refreshedAt: '2026-07-15T12:00:01.000Z',
        }),
        null,
    );
    assert.equal(initialDriverTrackingViewState.status, 'inactive');
    assert.equal(initialDriverTrackingViewState.lastAcceptedAt, null);
});

test('bursts retain only the newest unsent sample and equal timestamps preserve the original replay payload', () => {
    const first = sample(1_000, { latitude: 45.1 });
    const middle = sample(2_000, { latitude: 45.2 });
    const latest = sample(3_000, { latitude: 45.3 });
    const equalTimestampDifferentPayload = sample(3_000, { latitude: 46.3 });

    assert.equal(selectNewestDriverLocationSample(first, middle), middle);
    assert.equal(selectNewestDriverLocationSample(middle, latest), latest);
    assert.equal(
        selectNewestDriverLocationSample(
            latest,
            equalTimestampDifferentPayload,
        ),
        latest,
    );
    assert.equal(
        selectNewestDriverLocationSample(latest, equalTimestampDifferentPayload)
            .latitude,
        45.3,
    );
});

test('controller keeps one immutable in-flight sample and retries only the newest pending sample', () => {
    const controller = new DriverTrackingController();
    const first = sample(1_000, { latitude: 45.1 });
    const middle = sample(2_000, { latitude: 45.2 });
    const latest = sample(3_000, { latitude: 45.3 });
    assert.equal(controller.queueSample(first), true);
    const firstAttempt = controller.beginAttempt(1_000, 1_000);
    assert.equal(firstAttempt.kind, 'send');
    assert.equal(controller.beginAttempt(1_001, 1_001).kind, 'none');

    assert.equal(controller.queueSample(middle), true);
    assert.equal(controller.queueSample(latest), true);
    const retry = controller.retryInFlight({
        nowMonotonicMs: 2_000,
        retryAfterMs: null,
        randomValue: 0.5,
    });
    assert.equal(retry?.retryAttempt, 1);
    assert.equal(retry?.eligibleAtMonotonicMs, 11_000);
    assert.equal(controller.beginAttempt(10_999, 10_999).kind, 'wait');
    const retried = controller.beginAttempt(11_000, 11_000);
    assert.equal(retried.kind, 'send');
    if (retried.kind === 'send') assert.equal(retried.sample, latest);
});

test('equal-timestamp callbacks cannot mutate an ambiguous replay payload', () => {
    const controller = new DriverTrackingController();
    const original = sample(1_000, { latitude: 45.1, heading: 10 });
    const conflicting = sample(1_000, { latitude: 46.1, heading: 20 });
    controller.queueSample(original);
    assert.equal(controller.beginAttempt(1_000, 1_000).kind, 'send');
    assert.equal(controller.queueSample(conflicting), false);
    controller.retryInFlight({
        nowMonotonicMs: 2_000,
        retryAfterMs: null,
        randomValue: 0.5,
    });
    const replay = controller.beginAttempt(11_000, 11_000);
    assert.equal(replay.kind, 'send');
    if (replay.kind === 'send') {
        assert.equal(replay.sample, original);
        assert.equal(replay.sample.latitude, 45.1);
        assert.equal(replay.sample.heading, 10);
    }
    controller.acknowledge(
        {
            status: 'live',
            acceptedAt: '2026-07-15T12:00:00.000Z',
            refreshedAt: '2026-07-15T12:00:01.000Z',
            replayed: true,
        },
        12_000,
        12_000,
    );
    assert.equal(controller.queueSample(conflicting), false);
    assert.equal(controller.queueSample(sample(999)), false);
    assert.equal(controller.queueSample(sample(2_000)), true);
});

test('new GPS callbacks do not reset retry backoff or hide the failure count', () => {
    const controller = new DriverTrackingController();
    controller.queueSample(sample(1_000));
    controller.beginAttempt(1_000, 1_000);
    const failed = controller.retryInFlight({
        nowMonotonicMs: 2_000,
        retryAfterMs: 40_000,
        randomValue: 0.5,
    });
    assert.equal(failed?.eligibleAtMonotonicMs, 42_000);
    controller.queueSample(sample(2_000));
    assert.equal(controller.retryAttempt, 1);
    assert.equal(controller.nextAttemptAt(3_000), 42_000);
    assert.equal(controller.beginAttempt(41_999, 41_999).kind, 'wait');
});

test('acknowledgement resets retries while pending newer telemetry still respects throttle', () => {
    const controller = new DriverTrackingController();
    controller.queueSample(sample(1_000));
    controller.beginAttempt(1_000, 1_000);
    controller.queueSample(sample(2_000));
    controller.retryInFlight({
        nowMonotonicMs: 2_000,
        retryAfterMs: null,
        randomValue: 0.5,
    });
    controller.beginAttempt(11_000, 11_000);
    controller.acknowledge(
        {
            status: 'live',
            acceptedAt: '2026-07-15T12:00:00.000Z',
            refreshedAt: '2026-07-15T12:00:01.000Z',
            replayed: false,
        },
        12_000,
        Date.parse('2026-07-15T12:00:00.000Z'),
    );
    assert.equal(controller.retryAttempt, 0);
    assert.equal(controller.lastAcceptedAt, '2026-07-15T12:00:00.000Z');

    controller.queueSample(sample(3_000));
    assert.equal(controller.beginAttempt(20_999, 20_999).kind, 'wait');
    assert.equal(controller.beginAttempt(21_000, 21_000).kind, 'send');
});

test('permission revocation discards exact samples and resets retry bookkeeping', () => {
    const controller = new DriverTrackingController();
    controller.queueSample(sample(1_000));
    controller.beginAttempt(1_000, 1_000);
    controller.retryInFlight({
        nowMonotonicMs: 2_000,
        retryAfterMs: 40_000,
        randomValue: 0.5,
    });
    assert.equal(controller.retryAttempt, 1);
    controller.blockAndDiscardExactSamples();
    assert.equal(controller.hasInFlightSample, false);
    assert.equal(controller.hasPendingSample, false);
    assert.equal(controller.retryAttempt, 0);
    assert.equal(controller.beginAttempt(20_000, 20_000).kind, 'blocked');
    controller.allowPermissionUploads();
    controller.queueSample(sample(2_000));
    assert.equal(controller.nextAttemptAt(20_000), 20_000);
    controller.discard();
    assert.equal(controller.hasPendingSample, false);
    assert.equal(controller.beginAttempt(20_000, 20_000).kind, 'blocked');
});

test('permanent rejection drops newer pending telemetry while a sample rejection can continue with it', () => {
    const blocked = new DriverTrackingController();
    blocked.queueSample(sample(1_000));
    blocked.beginAttempt(1_000, 1_000);
    blocked.queueSample(sample(2_000));
    blocked.rejectInFlight({ acceptNewSample: false });
    assert.equal(blocked.hasPendingSample, false);
    assert.equal(blocked.beginAttempt(20_000, 20_000).kind, 'blocked');
    blocked.reconcileServerSeed(
        {
            tracking: {
                status: 'live',
                lastAcceptedAt: '2026-07-15T12:00:10.000Z',
                mapAvailable: true,
            },
            refreshedAt: '2026-07-15T12:00:11.000Z',
        },
        20_000,
        20_000,
    );
    assert.equal(blocked.retryAttempt, 0);
    assert.equal(blocked.queueSample(sample(3_000)), true);
    assert.equal(blocked.beginAttempt(20_000, 20_000).kind, 'send');

    const recoverable = new DriverTrackingController();
    recoverable.queueSample(sample(1_000));
    recoverable.beginAttempt(1_000, 1_000);
    recoverable.queueSample(sample(2_000));
    recoverable.rejectInFlight({ acceptNewSample: true });
    assert.equal(recoverable.hasPendingSample, true);
    assert.equal(recoverable.beginAttempt(10_999, 10_999).kind, 'wait');
    assert.equal(recoverable.beginAttempt(11_000, 11_000).kind, 'send');
});

test('late acknowledgements cannot regress a newer seed and equal seeds can age it conservatively', () => {
    const controller = new DriverTrackingController();
    const newerSeed = controller.reconcileServerSeed(
        {
            tracking: {
                status: 'live',
                lastAcceptedAt: '2026-07-15T12:00:10.000Z',
                mapAvailable: true,
            },
            refreshedAt: '2026-07-15T12:00:11.000Z',
        },
        1_000,
        100_000,
    );
    assert.equal(newerSeed?.status, 'active');
    assert.equal(
        controller.acknowledge(
            {
                status: 'live',
                acceptedAt: '2026-07-15T12:00:05.000Z',
                refreshedAt: '2026-07-15T12:00:06.000Z',
                replayed: false,
            },
            2_000,
            101_000,
        ),
        false,
    );
    assert.equal(controller.lastAcceptedAt, '2026-07-15T12:00:10.000Z');

    const equalButOlder = controller.reconcileServerSeed(
        {
            tracking: {
                status: 'delayed',
                lastAcceptedAt: '2026-07-15T12:00:10.000Z',
                mapAvailable: true,
            },
            refreshedAt: '2026-07-15T12:00:41.000Z',
        },
        2_000,
        101_000,
    );
    assert.equal(equalButOlder?.status, 'delayed');
    assert.equal(controller.acknowledgementStatus(2_000, 101_000), 'delayed');
});

test('wall elapsed time catches sleep even if the monotonic clock pauses', () => {
    const controller = new DriverTrackingController();
    controller.acknowledge(
        {
            status: 'live',
            acceptedAt: '2026-07-15T12:00:00.000Z',
            refreshedAt: '2026-07-15T12:00:00.000Z',
            replayed: false,
        },
        5_000,
        100_000,
    );
    assert.equal(controller.acknowledgementStatus(5_000, 100_000), 'active');
    assert.equal(controller.acknowledgementStatus(5_000, 130_001), 'delayed');
    assert.equal(driverTrackingUploadTimeoutMs, 20_000);
});

test('acknowledgement freshness includes server processing age', () => {
    const controller = new DriverTrackingController();
    controller.acknowledge(
        {
            status: 'live',
            acceptedAt: '2026-07-15T12:00:00.000Z',
            refreshedAt: '2026-07-15T12:00:15.000Z',
            replayed: false,
        },
        50_000,
        100_000,
    );
    assert.equal(controller.acknowledgementStatus(64_999, 114_999), 'active');
    assert.equal(controller.acknowledgementStatus(65_001, 115_001), 'delayed');

    const transitController = new DriverTrackingController();
    transitController.acknowledge(
        {
            status: 'live',
            acceptedAt: '2026-07-15T12:00:00.000Z',
            refreshedAt: '2026-07-15T12:00:00.000Z',
            replayed: false,
        },
        50_000,
        100_000,
        19_000,
    );
    assert.equal(
        transitController.acknowledgementStatus(61_000, 111_000),
        'active',
    );
    assert.equal(
        transitController.acknowledgementStatus(61_001, 111_001),
        'delayed',
    );
});

test('retry backoff grows within jitter bounds and remains capped', () => {
    assert.equal(
        driverTrackingRetryDelayMs({ retryAttempt: 1, randomValue: 0 }),
        4_000,
    );
    assert.equal(
        driverTrackingRetryDelayMs({ retryAttempt: 1, randomValue: 1 }),
        6_000,
    );
    assert.equal(
        driverTrackingRetryDelayMs({ retryAttempt: 2, randomValue: 0 }),
        8_000,
    );
    assert.equal(
        driverTrackingRetryDelayMs({ retryAttempt: 4, randomValue: 0.5 }),
        40_000,
    );
    assert.equal(
        driverTrackingRetryDelayMs({ retryAttempt: 12, randomValue: 1 }),
        driverTrackingMaximumRetryDelayMs,
    );
    assert.equal(
        driverTrackingRetryDelayMs({
            retryAttempt: 2,
            randomValue: 0,
            retryAfterMs: 90_000,
        }),
        driverTrackingMaximumRetryDelayMs,
    );
});

test('every attempt respects the minimum interval even when retry is advanced', () => {
    assert.equal(
        driverTrackingNextAttemptAt({
            nowMonotonicMs: 12_000,
            lastAttemptAtMonotonicMs: 10_000,
            requestedDelayMs: 0,
        }),
        10_000 + driverTrackingMinimumAttemptIntervalMs,
    );
    assert.equal(
        driverTrackingNextAttemptAt({
            nowMonotonicMs: 12_000,
            lastAttemptAtMonotonicMs: 10_000,
            requestedDelayMs: 40_000,
        }),
        52_000,
    );
    assert.equal(
        driverTrackingNextAttemptAt({
            nowMonotonicMs: 12_000,
            lastAttemptAtMonotonicMs: null,
            requestedDelayMs: 0,
        }),
        12_000,
    );
});

test('response classification retries ambiguous failures but reconciles poisoned timestamps', () => {
    assert.equal(
        classifyDriverLocationResponse({
            status: 200,
            body: { status: 'live' },
            retryAfter: null,
        }).kind,
        'retry',
    );
    assert.deepEqual(
        classifyDriverLocationResponse({
            status: 503,
            body: null,
            retryAfter: '25',
        }),
        { kind: 'retry', retryAfterMs: 25_000 },
    );
    assert.deepEqual(
        classifyDriverLocationResponse({
            status: 409,
            body: { code: 'location-stale' },
            retryAfter: null,
        }),
        { kind: 'reconcile' },
    );
    assert.deepEqual(
        classifyDriverLocationResponse({
            status: 409,
            body: { code: 'location-conflict' },
            retryAfter: null,
        }),
        { kind: 'reconcile' },
    );
    assert.deepEqual(
        classifyDriverLocationResponse({
            status: 403,
            body: null,
            retryAfter: null,
        }),
        {
            kind: 'reject',
            acceptNewSample: false,
            reason: 'server-rejected',
        },
    );
    assert.deepEqual(
        classifyDriverLocationResponse({
            status: 400,
            body: null,
            retryAfter: null,
        }),
        {
            kind: 'reject',
            acceptNewSample: true,
            reason: 'invalid-sample',
        },
    );
});

test('Retry-After supports seconds and dates without exceeding the cap', () => {
    const nowMs = Date.parse('2026-07-15T12:00:00.000Z');
    assert.equal(parseRetryAfterMs('12', nowMs), 12_000);
    assert.equal(
        parseRetryAfterMs('Wed, 15 Jul 2026 12:00:45 GMT', nowMs),
        45_000,
    );
    assert.equal(
        parseRetryAfterMs('Wed, 15 Jul 2026 12:02:00 GMT', nowMs),
        driverTrackingMaximumRetryDelayMs,
    );
    assert.equal(parseRetryAfterMs('invalid', nowMs), null);
});

test('acknowledged tracking crosses to delayed only after the live threshold', () => {
    assert.equal(driverTrackingStatusAfterElapsed(0), 'active');
    assert.equal(
        driverTrackingStatusAfterElapsed(driverTrackingLiveThresholdMs),
        'active',
    );
    assert.equal(
        driverTrackingStatusAfterElapsed(driverTrackingLiveThresholdMs + 1),
        'delayed',
    );
});

test('expired samples are discarded at the exact server TTL boundary', () => {
    const pending = sample(1_000, { expiresAtMonotonicMs: 121_000 });
    assert.equal(
        driverLocationSampleIsExpired(pending, 121_000, 121_000),
        false,
    );
    assert.equal(
        driverLocationSampleIsExpired(pending, 121_001, 121_000),
        true,
    );
    assert.equal(
        driverLocationSampleIsExpired(pending, 121_000, 121_001),
        true,
    );
});

test('older dashboard polling cannot regress a newer local acknowledgement', () => {
    const older = parseDriverTrackingServerSeed({
        tracking: {
            status: 'live',
            lastAcceptedAt: '2026-07-15T12:00:00.000Z',
            mapAvailable: true,
        },
        refreshedAt: '2026-07-15T12:00:05.000Z',
    });
    const newerAcceptedAt = Date.parse('2026-07-15T12:00:10.000Z');
    assert.ok(older);
    assert.equal(
        driverTrackingServerSeedIsNewer(older, newerAcceptedAt),
        false,
    );
    assert.equal(driverTrackingServerSeedIsNewer(older, null), true);
});

test('dashboard seed age uses server timestamps instead of the device clock', () => {
    const live = parseDriverTrackingServerSeed({
        tracking: {
            status: 'live',
            lastAcceptedAt: '2026-07-15T12:00:00.000Z',
            mapAvailable: true,
        },
        refreshedAt: '2026-07-15T12:00:30.000Z',
    });
    const delayed = parseDriverTrackingServerSeed({
        tracking: {
            status: 'delayed',
            lastAcceptedAt: '2026-07-15T12:00:00.000Z',
            mapAvailable: true,
        },
        refreshedAt: '2026-07-15T12:00:31.000Z',
    });
    assert.equal(live?.status, 'active');
    assert.equal(delayed?.status, 'delayed');
    assert.equal(delayed?.ageAtRefreshMs, 31_000);
});
