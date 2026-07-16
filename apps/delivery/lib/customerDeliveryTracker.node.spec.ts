import assert from 'node:assert/strict';
import test from 'node:test';
import { deliveryRunExactLocationTtlMs } from '@gredice/storage';
import {
    type CustomerDeliveryTrackerInput,
    customerDeliveryTracker,
} from './customerDeliveryTracker';

const now = '2026-07-16T10:00:00.000Z';

function input(
    overrides: Partial<CustomerDeliveryTrackerInput> = {},
): CustomerDeliveryTrackerInput {
    return {
        now,
        runState: 'active',
        stopState: 'pending',
        stopsAhead: 0,
        promisedWindowStartAt: '2026-07-16T10:00:00.000Z',
        promisedWindowEndAt: '2026-07-16T12:00:00.000Z',
        estimatedArrivalAt: '2026-07-16T10:30:00.000Z',
        estimatesCalculatedAt: '2026-07-16T09:59:00.000Z',
        estimateSource: 'legacy',
        routePlanVersion: 1,
        hasTrafficRouteArtifact: true,
        reroutePending: false,
        trackingStatus: 'live',
        trackingLastAcceptedAt: '2026-07-16T09:58:30.000Z',
        ...overrides,
    };
}

test('presents a persisted Google route artifact as high-confidence traffic progress', () => {
    assert.deepEqual(customerDeliveryTracker(input()), {
        eta: {
            source: 'traffic-route',
            calculatedAt: '2026-07-16T09:59:00.000Z',
            freshness: 'fresh',
            confidence: 'high',
            rangeStartAt: '2026-07-16T10:25:00.000Z',
            rangeEndAt: '2026-07-16T10:40:00.000Z',
            remainingMinSeconds: 1_500,
            remainingMaxSeconds: 2_400,
        },
        progress: { phase: 'next', stopsAhead: 0, delayed: false },
    });
});

test('keeps a fresh Google refresh when a newer accepted beacon advances tracking', () => {
    const result = customerDeliveryTracker(
        input({ trackingLastAcceptedAt: '2026-07-16T09:59:30.000Z' }),
    );
    assert.equal(result.eta.source, 'traffic-route');
    assert.equal(result.eta.confidence, 'high');
});

test('qualifies a pickup-aware Google estimate as an approximate route plan even with live GPS', () => {
    const result = customerDeliveryTracker(
        input({
            estimateSource: 'google',
            routePlanVersion: 2,
            trackingStatus: 'live',
        }),
    );
    assert.deepEqual(result.eta, {
        source: 'route-plan',
        calculatedAt: '2026-07-16T09:59:00.000Z',
        freshness: 'fresh',
        confidence: 'approximate',
        rangeStartAt: '2026-07-16T10:25:00.000Z',
        rangeEndAt: '2026-07-16T10:40:00.000Z',
        remainingMinSeconds: 1_500,
        remainingMaxSeconds: 2_400,
    });
    assert.deepEqual(result.progress, {
        phase: 'next',
        stopsAhead: 0,
        delayed: false,
    });
});

test('falls back to the promised window for local, legacy, rerouting, and malformed routes', () => {
    const cases: readonly [
        label: string,
        overrides: Partial<CustomerDeliveryTrackerInput>,
    ][] = [
        ['local', { estimateSource: 'local', routePlanVersion: 2 }],
        [
            'legacy initial plan',
            {
                hasTrafficRouteArtifact: false,
                trackingLastAcceptedAt: null,
            },
        ],
        ['rerouting', { reroutePending: true }],
        ['unknown source', { estimateSource: 'private-provider' }],
        ['invalid route version', { routePlanVersion: 0 }],
        [
            'legacy route without Google artifact',
            { hasTrafficRouteArtifact: false },
        ],
        ['unproven v1 route', { trackingLastAcceptedAt: null }],
        [
            'future calculation',
            { estimatesCalculatedAt: '2026-07-16T10:01:00.000Z' },
        ],
        ['malformed arrival', { estimatedArrivalAt: 'not-a-date' }],
    ];
    for (const [label, overrides] of cases) {
        const result = customerDeliveryTracker(input(overrides));
        assert.deepEqual(
            result.eta,
            {
                source: 'promised-window',
                calculatedAt: null,
                freshness: 'fallback',
                confidence: 'approximate',
                rangeStartAt: '2026-07-16T10:00:00.000Z',
                rangeEndAt: '2026-07-16T12:00:00.000Z',
                remainingMinSeconds: 0,
                remainingMaxSeconds: 7_200,
            },
            label,
        );
    }
});

test('uses the shared two-minute horizon and labels an expired Google ETA stale', () => {
    const exactlyStale = new Date(
        Date.parse(now) - deliveryRunExactLocationTtlMs,
    ).toISOString();
    const result = customerDeliveryTracker(
        input({
            estimatesCalculatedAt: exactlyStale,
            trackingLastAcceptedAt: '2026-07-16T09:57:30.000Z',
        }),
    );
    assert.deepEqual(result.eta, {
        source: 'promised-window',
        calculatedAt: exactlyStale,
        freshness: 'stale',
        confidence: 'approximate',
        rangeStartAt: '2026-07-16T10:00:00.000Z',
        rangeEndAt: '2026-07-16T12:00:00.000Z',
        remainingMinSeconds: 0,
        remainingMaxSeconds: 7_200,
    });
});

test('keeps persisted v1 Google provenance stale when tracking is offline', () => {
    const result = customerDeliveryTracker(
        input({
            now: '2026-07-16T10:02:00.000Z',
            estimatesCalculatedAt: '2026-07-16T10:00:00.000Z',
            trackingLastAcceptedAt: '2026-07-16T09:59:30.000Z',
            trackingStatus: 'offline',
        }),
    );
    assert.equal(result.eta.source, 'promised-window');
    assert.equal(result.eta.freshness, 'stale');
    assert.equal(result.eta.calculatedAt, '2026-07-16T10:00:00.000Z');
});

test('does not clamp a genuinely late fresh traffic ETA to the promise', () => {
    const result = customerDeliveryTracker(
        input({ estimatedArrivalAt: '2026-07-16T12:20:00.000Z' }),
    );
    assert.equal(result.eta.source, 'traffic-route');
    assert.equal(result.eta.rangeStartAt, '2026-07-16T12:15:00.000Z');
    assert.equal(result.eta.rangeEndAt, '2026-07-16T12:30:00.000Z');
    assert.equal(result.eta.remainingMinSeconds, 8_100);
    assert.equal(result.eta.remainingMaxSeconds, 9_000);
    assert.equal(result.progress.delayed, true);
});

test('does not present an expired promise window as a current arrival estimate', () => {
    const result = customerDeliveryTracker(
        input({
            now: '2026-07-16T12:05:00.000Z',
            estimateSource: 'local',
            routePlanVersion: 2,
        }),
    );
    assert.deepEqual(result.eta, {
        source: 'promised-window',
        calculatedAt: null,
        freshness: 'unavailable',
        confidence: 'none',
        rangeStartAt: null,
        rangeEndAt: null,
        remainingMinSeconds: null,
        remainingMaxSeconds: null,
    });
    assert.equal(result.progress.delayed, true);
});

test('marks a fresh route range delayed once the promised window has passed', () => {
    const result = customerDeliveryTracker(
        input({
            now: '2026-07-16T12:00:30.000Z',
            estimateSource: 'google',
            routePlanVersion: 2,
            estimatedArrivalAt: '2026-07-16T12:00:00.000Z',
            estimatesCalculatedAt: '2026-07-16T12:00:15.000Z',
            trackingLastAcceptedAt: '2026-07-16T12:00:20.000Z',
        }),
    );
    assert.equal(result.eta.source, 'route-plan');
    assert.equal(result.eta.rangeStartAt, '2026-07-16T12:00:30.000Z');
    assert.equal(result.progress.delayed, true);
});

test('lower-bounds the route range at now without collapsing it', () => {
    const result = customerDeliveryTracker(
        input({ estimatedArrivalAt: '2026-07-16T10:02:00.000Z' }),
    );
    assert.equal(result.eta.rangeStartAt, now);
    assert.equal(result.eta.rangeEndAt, '2026-07-16T10:12:00.000Z');
    assert.equal(result.eta.remainingMinSeconds, 0);
    assert.equal(result.eta.remainingMaxSeconds, 720);
});

test('reports unavailable ETA for missing, reversed, or malformed promised windows', () => {
    const cases: readonly Partial<CustomerDeliveryTrackerInput>[] = [
        { estimateSource: 'local', promisedWindowStartAt: null },
        {
            estimateSource: 'legacy',
            promisedWindowEndAt: null,
            trackingLastAcceptedAt: null,
        },
        {
            estimateSource: 'local',
            promisedWindowStartAt: '2026-07-16T12:00:00.000Z',
            promisedWindowEndAt: '2026-07-16T10:00:00.000Z',
        },
        {
            estimateSource: 'local',
            promisedWindowStartAt: '2026-07-16T10:00:00.000Z',
            promisedWindowEndAt: '2026-07-16T10:00:00.000Z',
        },
        {
            estimateSource: 'local',
            promisedWindowEndAt: '16. srpnja u podne',
        },
    ];
    for (const overrides of cases) {
        assert.deepEqual(customerDeliveryTracker(input(overrides)).eta, {
            source: 'promised-window',
            calculatedAt: null,
            freshness: 'unavailable',
            confidence: 'none',
            rangeStartAt: null,
            rangeEndAt: null,
            remainingMinSeconds: null,
            remainingMaxSeconds: null,
        });
    }
});

test('derives scheduled, on-route, next, arrived, and unavailable phases', () => {
    const phases: readonly [
        label: string,
        overrides: Partial<CustomerDeliveryTrackerInput>,
        expected: {
            phase:
                | 'scheduled'
                | 'on-route'
                | 'next'
                | 'arrived'
                | 'unavailable';
            stopsAhead: number | null;
        },
    ][] = [
        [
            'scheduled',
            { runState: null, stopState: null, stopsAhead: null },
            { phase: 'scheduled', stopsAhead: null },
        ],
        ['on route', { stopsAhead: 1 }, { phase: 'on-route', stopsAhead: 1 }],
        ['next', { stopsAhead: 0 }, { phase: 'next', stopsAhead: 0 }],
        [
            'arrived',
            { stopState: 'arrived', stopsAhead: 0 },
            { phase: 'arrived', stopsAhead: 0 },
        ],
        [
            'route unavailable',
            { runState: 'cancelled', stopState: 'cancelled' },
            { phase: 'unavailable', stopsAhead: null },
        ],
        [
            'missing itinerary',
            { stopsAhead: null },
            { phase: 'unavailable', stopsAhead: null },
        ],
        [
            'invalid checkpoint count',
            { stopsAhead: -1 },
            { phase: 'unavailable', stopsAhead: null },
        ],
    ];
    for (const [label, overrides, expected] of phases) {
        const progress = customerDeliveryTracker(input(overrides)).progress;
        assert.deepEqual(
            { phase: progress.phase, stopsAhead: progress.stopsAhead },
            expected,
            label,
        );
    }
});

test('uses the server-provided physical pickup and retry checkpoint count', () => {
    const result = customerDeliveryTracker(
        input({ stopState: 'deferred', stopsAhead: 2 }),
    );
    assert.deepEqual(result.progress, {
        phase: 'on-route',
        stopsAhead: 2,
        delayed: false,
    });
});

test('keeps the pre-grouped bulk count instead of counting its orders', () => {
    const result = customerDeliveryTracker(input({ stopsAhead: 1 }));
    assert.equal(result.progress.stopsAhead, 1);
});

test('serializes only the derived privacy-safe contract', () => {
    const privateSentinel = 'PRIVATE CUSTOMER OR DRIVER DATA 4136';
    const privateInput: CustomerDeliveryTrackerInput & {
        runId: string;
        address: string;
        customerName: string;
        routeLegDurationSeconds: number;
        driverLocation: { latitude: number; longitude: number };
    } = {
        ...input({ stopsAhead: 1 }),
        runId: privateSentinel,
        address: privateSentinel,
        customerName: privateSentinel,
        routeLegDurationSeconds: 123_456,
        driverLocation: { latitude: 45.812, longitude: 15.977 },
    };

    const result = customerDeliveryTracker(privateInput);
    const serialized = JSON.stringify(result);
    assert.equal(serialized.includes(privateSentinel), false);
    for (const privateKey of [
        'id',
        'address',
        'customerName',
        'runId',
        'driverLocation',
        'routeLegDurationSeconds',
        'latitude',
        'longitude',
        'stops',
        'deliveryCount',
    ]) {
        assert.equal(serialized.includes(`"${privateKey}"`), false, privateKey);
    }
    assert.deepEqual(Object.keys(result).sort(), ['eta', 'progress']);
    assert.deepEqual(Object.keys(result.eta).sort(), [
        'calculatedAt',
        'confidence',
        'freshness',
        'rangeEndAt',
        'rangeStartAt',
        'remainingMaxSeconds',
        'remainingMinSeconds',
        'source',
    ]);
    assert.deepEqual(Object.keys(result.progress).sort(), [
        'delayed',
        'phase',
        'stopsAhead',
    ]);
});
