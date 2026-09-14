import assert from 'node:assert/strict';
import test from 'node:test';
import type { DeliveryRunExecutionStep } from '@gredice/storage';
import {
    type DeliveryMobileProjectionSource,
    deliveryMobileActiveRouteEtag,
    projectDeliveryMobileActiveRoute,
    requestMatchesEtag,
} from './mobileActiveRoute';

const generatedAt = new Date('2026-08-28T10:00:00.000Z');

function pickupNode(id: string, itinerarySequence: number) {
    return {
        id,
        itinerarySequence,
        formattedAddress: `Adresa preuzimanja ${itinerarySequence}`,
        latitude: 45.8 + itinerarySequence / 1_000,
        longitude: 15.9 + itinerarySequence / 1_000,
        estimatedArrivalAt: new Date(
            generatedAt.getTime() + itinerarySequence * 60_000,
        ),
        incomingTravelSeconds: itinerarySequence * 60,
        incomingDistanceMeters: itinerarySequence * 1_000,
    };
}

function deliveryStop(id: number, itinerarySequence: number) {
    return {
        id,
        itinerarySequence,
        formattedAddress: `Adresa dostave ${itinerarySequence}`,
        latitude: 45.7 + itinerarySequence / 1_000,
        longitude: 16 + itinerarySequence / 1_000,
        estimatedArrivalAt: new Date(
            generatedAt.getTime() + itinerarySequence * 60_000,
        ),
        estimatedTravelSeconds: itinerarySequence * 60,
        estimatedDistanceMeters: itinerarySequence * 1_000,
    };
}

function deliveryStep({
    sequence,
    state = 'upcoming',
    pickupConfirmed = true,
    retryLaneRank,
    retryAttempt,
}: {
    sequence: number;
    state?: DeliveryRunExecutionStep['state'];
    pickupConfirmed?: boolean;
    retryLaneRank?: number;
    retryAttempt?: number;
}): Extract<DeliveryRunExecutionStep, { kind: 'delivery' }> {
    return {
        kind: 'delivery',
        itinerarySequence: sequence,
        stopKey: `stop-${sequence}`,
        stopIds: [sequence],
        actionableStopIds: [sequence],
        pickupConfirmed,
        retryLaneRank,
        retryAttempt,
        state,
    };
}

function source({
    executionSteps,
    reroutePending = false,
}: {
    executionSteps: DeliveryRunExecutionStep[];
    reroutePending?: boolean;
}): DeliveryMobileProjectionSource {
    return {
        run: {
            id: 'internal-run-id-must-not-leak',
            revision: 7,
            reroutePending,
            pickupNodes: Array.from({ length: 9 }, (_, index) =>
                pickupNode(`pickup-${index + 1}`, index + 1),
            ),
            stops: Array.from({ length: 9 }, (_, index) =>
                deliveryStop(index + 1, index + 1),
            ),
        },
        executionSteps,
    };
}

test('projects no active run as a versioned null route', () => {
    const result = projectDeliveryMobileActiveRoute({
        source: null,
        generatedAt,
    });

    assert.deepEqual(result, {
        response: {
            schemaVersion: 1,
            generatedAt: generatedAt.toISOString(),
            route: null,
        },
        omittedInvalidNodeCount: 0,
    });
});

test('keeps canonical order, excludes completed and locked steps, and bounds the navigable window', () => {
    const result = projectDeliveryMobileActiveRoute({
        source: source({
            executionSteps: [
                deliveryStep({ sequence: 9, state: 'completed' }),
                {
                    kind: 'pickup',
                    pickupNodeId: 'pickup-1',
                    itinerarySequence: 1,
                    manifestIds: ['manifest-private'],
                    state: 'current',
                },
                deliveryStep({
                    sequence: 2,
                    pickupConfirmed: false,
                }),
                {
                    kind: 'pickup',
                    pickupNodeId: 'pickup-8',
                    itinerarySequence: 8,
                    manifestIds: ['next-manifest-private'],
                    state: 'upcoming',
                },
                deliveryStep({
                    sequence: 7,
                    retryLaneRank: 1,
                    retryAttempt: 2,
                }),
                deliveryStep({ sequence: 3 }),
                deliveryStep({ sequence: 4 }),
                deliveryStep({ sequence: 5 }),
                deliveryStep({ sequence: 6 }),
                deliveryStep({ sequence: 7 }),
            ],
        }),
        generatedAt,
    });

    const route = result.response.route;
    assert.ok(route);
    assert.deepEqual(
        route.stops.map(({ kind, sequence, actionState }) => ({
            kind,
            sequence,
            actionState,
        })),
        [
            { kind: 'pickup', sequence: 1, actionState: 'current' },
            { kind: 'pickup', sequence: 8, actionState: 'upcoming' },
            { kind: 'delivery', sequence: 7, actionState: 'upcoming' },
            { kind: 'delivery', sequence: 3, actionState: 'upcoming' },
            { kind: 'delivery', sequence: 4, actionState: 'upcoming' },
        ],
    );
    assert.equal(route.currentNavigationId, route.stops[0]?.navigationId);
    assert.equal(result.omittedInvalidNodeCount, 0);
});

test('omits invalid navigable coordinates and emits only generic privacy-minimized fields', () => {
    const projectionSource = source({
        executionSteps: [
            deliveryStep({ sequence: 1, state: 'current' }),
            deliveryStep({ sequence: 2 }),
            deliveryStep({ sequence: 3 }),
            deliveryStep({ sequence: 4 }),
            deliveryStep({ sequence: 5 }),
            deliveryStep({ sequence: 6 }),
            deliveryStep({ sequence: 7 }),
        ],
    });
    const invalidStop = projectionSource.run.stops[0];
    assert.ok(invalidStop);
    invalidStop.latitude = Number.NaN;

    const result = projectDeliveryMobileActiveRoute({
        source: projectionSource,
        generatedAt,
    });
    const route = result.response.route;
    assert.ok(route);
    assert.equal(result.omittedInvalidNodeCount, 1);
    assert.deepEqual(
        route.stops.map((stop) => stop.sequence),
        [2, 3, 4, 5, 6],
    );
    assert.equal(route.currentNavigationId, null);
    assert.match(route.id, /^route:[A-Za-z0-9_-]{32}$/);
    assert.doesNotMatch(route.id, /internal-run-id/);

    const stop = route.stops[0];
    assert.ok(stop);
    assert.equal(stop.label, 'Dostava 2');
    assert.match(stop.navigationId, /^delivery:[A-Za-z0-9_-]{24}$/);
    assert.deepEqual(Object.keys(stop).sort(), [
        'actionState',
        'address',
        'distanceMeters',
        'estimatedArrivalAt',
        'kind',
        'label',
        'latitude',
        'longitude',
        'navigationId',
        'sequence',
        'travelSeconds',
    ]);
    const serialized = JSON.stringify(result.response);
    for (const forbidden of [
        'contact',
        'phone',
        'email',
        'notes',
        'harvest',
        'manifest',
        'customer',
        'accountId',
        'driver',
        'polyline',
        'internal-run-id-must-not-leak',
    ]) {
        assert.doesNotMatch(serialized, new RegExp(forbidden, 'i'));
    }
});

test('hides route estimates while canonical rerouting is pending', () => {
    const result = projectDeliveryMobileActiveRoute({
        source: source({
            reroutePending: true,
            executionSteps: [deliveryStep({ sequence: 1, state: 'current' })],
        }),
        generatedAt,
    });
    const stop = result.response.route?.stops[0];
    assert.ok(stop);
    assert.equal(stop.estimatedArrivalAt, null);
    assert.equal(stop.travelSeconds, null);
    assert.equal(stop.distanceMeters, null);
});

test('ETags are subject-bound and track visible route state without address text', () => {
    const result = projectDeliveryMobileActiveRoute({
        source: source({
            executionSteps: [deliveryStep({ sequence: 1, state: 'current' })],
        }),
        generatedAt,
    });
    const subject = { userId: 'driver-1', accountId: 'account-1' };
    const original = deliveryMobileActiveRouteEtag({
        response: result.response,
        subject,
    });
    const addressChanged = structuredClone(result.response);
    addressChanged.generatedAt = '2026-08-28T11:00:00.000Z';
    assert.ok(addressChanged.route?.stops[0]);
    addressChanged.route.stops[0].address = 'Nova adresa koja nije u ETagu';
    assert.equal(
        deliveryMobileActiveRouteEtag({
            response: addressChanged,
            subject,
        }),
        original,
    );

    const coordinatesChanged = structuredClone(result.response);
    assert.ok(coordinatesChanged.route?.stops[0]);
    coordinatesChanged.route.stops[0].latitude += 0.001;
    assert.notEqual(
        deliveryMobileActiveRouteEtag({
            response: coordinatesChanged,
            subject,
        }),
        original,
    );

    const revisionChanged = structuredClone(result.response);
    assert.ok(revisionChanged.route);
    revisionChanged.route.revision += 1;
    assert.notEqual(
        deliveryMobileActiveRouteEtag({
            response: revisionChanged,
            subject,
        }),
        original,
    );
    assert.notEqual(
        deliveryMobileActiveRouteEtag({
            response: result.response,
            subject: { ...subject, accountId: 'account-2' },
        }),
        original,
    );
});

test('If-None-Match handles exact, weak, list, and wildcard validators', () => {
    const etag = '"route-state"';
    assert.equal(requestMatchesEtag(etag, etag), true);
    assert.equal(requestMatchesEtag(`W/${etag}`, etag), true);
    assert.equal(requestMatchesEtag(`"other", W/${etag}`, etag), true);
    assert.equal(requestMatchesEtag('*', etag), true);
    assert.equal(requestMatchesEtag('"other"', etag), false);
    assert.equal(requestMatchesEtag(undefined, etag), false);
});
