import assert from 'node:assert/strict';
import test from 'node:test';
import {
    customerDeliveryLifecycle,
    customerDeliveryRequestSummary,
    customerPickupInstructions,
    customerPickupLifecycle,
    customerPickupRequestSummary,
    customerPickupStatusLabel,
} from './customerDeliveryPresentation';
import type { DeliveryStopSummary } from './deliveryDashboardTypes';

const harvest = {
    plantName: 'Rajčica',
    operationName: 'Berba',
    raisedBedName: 'Gredica 4',
    fieldName: 'Polje 2',
    tracePath: '/trag/customer-owned',
};

test('projects a delivery to the exact customer-safe DTO', () => {
    const privateSentinel = 'PRIVATE DRIVER DATA 4135';
    const source: DeliveryStopSummary = {
        id: 41,
        requestId: 'request-delivery',
        sequence: 7,
        stopState: 'pending',
        requestState: 'ready',
        statusLabel: 'Vozač stiže',
        isCurrent: true,
        contactName: 'Korina Kupac',
        phone: privateSentinel,
        address: 'Ilica 1, 10000 Zagreb, HR',
        addressLabel: 'Dom',
        requestNotes: 'Pozvoni na portafon.',
        deliveryNotes: privateSentinel,
        slotStartAt: '2026-07-16T10:00:00.000Z',
        slotEndAt: '2026-07-16T12:00:00.000Z',
        estimatedArrivalAt: '2026-07-16T10:30:00.000Z',
        estimatedTravelSeconds: 900,
        estimatedDistanceMeters: 5_000,
        reroutePending: false,
        arrivedAt: null,
        deliveredAt: null,
        harvest,
        receipt: null,
        recovery: null,
        tracking: {
            status: 'live',
            lastAcceptedAt: '2026-07-16T09:58:30.000Z',
            mapAvailable: true,
            exactLocationExpiresInMs: 30_000,
        },
        runId: 'safe-map-run',
        deliveryCount: 2,
        recipientCount: 2,
        deliveries: [
            {
                stopId: 99,
                stopState: 'pending',
                requestId: privateSentinel,
                requestState: 'ready',
                contactName: privateSentinel,
                phone: privateSentinel,
                addressLabel: privateSentinel,
                requestNotes: privateSentinel,
                deliveryNotes: privateSentinel,
                harvest,
                exception: null,
            },
        ],
        actionState: 'current',
        lockedReason: privateSentinel,
    };

    const projectionContext = {
        now: '2026-07-16T10:00:00.000Z',
        runState: 'active',
        stopsAhead: 0,
        estimatesCalculatedAt: '2026-07-16T09:59:00.000Z',
        estimateSource: 'legacy',
        routePlanVersion: 1,
        hasTrafficRouteArtifact: true,
        trackingStatus: 'live',
        trackingLastAcceptedAt: '2026-07-16T09:58:30.000Z',
    } as const;
    const projected = customerDeliveryRequestSummary(source, projectionContext);

    assert.deepEqual(projected, {
        mode: 'delivery',
        lifecycle: 'active',
        requestId: 'request-delivery',
        status: 'ready',
        statusLabel: 'Vozač stiže',
        requestNotes: 'Pozvoni na portafon.',
        slotStartAt: '2026-07-16T10:00:00.000Z',
        slotEndAt: '2026-07-16T12:00:00.000Z',
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
        progress: {
            phase: 'next',
            stopsAhead: 0,
            delayed: false,
        },
        deliveredAt: null,
        harvest,
        destination: {
            recipientName: 'Korina Kupac',
            address: 'Ilica 1, 10000 Zagreb, HR',
            addressLabel: 'Dom',
        },
        receipt: null,
        recovery: null,
        tracking: {
            status: 'live',
            lastAcceptedAt: '2026-07-16T09:58:30.000Z',
            mapAvailable: true,
            exactLocationExpiresInMs: 30_000,
        },
        mapPath: '/api/map/safe-map-run',
    });
    const serialized = JSON.stringify(projected);
    assert.equal(serialized.includes(privateSentinel), false);
    for (const privateKey of [
        'id',
        'sequence',
        'stopState',
        'phone',
        'deliveryNotes',
        'runId',
        'deliveries',
        'actionState',
        'lockedReason',
        'latitude',
        'longitude',
        'accuracy',
        'heading',
        'speed',
        'estimatedArrivalAt',
        'estimatedTravelSeconds',
        'estimatedDistanceMeters',
        'reroutePending',
    ]) {
        assert.equal(privateKey in projected, false, privateKey);
    }

    const laterStop = customerDeliveryRequestSummary(
        { ...source, tracking: null },
        { ...projectionContext, stopsAhead: 2 },
    );
    assert.equal(laterStop.eta.source, 'traffic-route');
    assert.equal(laterStop.progress.stopsAhead, 2);
    assert.equal(laterStop.tracking, null);
    assert.equal(laterStop.mapPath, null);
});

test('projects pickup status, public location, and instructions without delivery fields', () => {
    const privateSentinel = 'PRIVATE PICKUP DATA 4135';
    const source = {
        requestId: 'request-pickup',
        status: 'ready',
        requestNotes: 'Donijet ću svoju košaru.',
        slotStartAt: '2026-07-16T14:00:00.000Z',
        slotEndAt: '2026-07-16T16:00:00.000Z',
        harvest,
        location: {
            name: 'Gredice HQ',
            address: 'Vrtna 1, 10000 Zagreb, HR',
            instructions: customerPickupInstructions('ready'),
        },
        pickedUpAt: null,
        runId: privateSentinel,
        tracking: privateSentinel,
        deliveryNotes: privateSentinel,
    };

    const projected = customerPickupRequestSummary(source);

    assert.deepEqual(projected, {
        mode: 'pickup',
        lifecycle: 'upcoming',
        requestId: 'request-pickup',
        status: 'ready',
        statusLabel: 'Spremno za preuzimanje',
        requestNotes: 'Donijet ću svoju košaru.',
        slotStartAt: '2026-07-16T14:00:00.000Z',
        slotEndAt: '2026-07-16T16:00:00.000Z',
        harvest,
        location: {
            name: 'Gredice HQ',
            address: 'Vrtna 1, 10000 Zagreb, HR',
            instructions:
                'Urod je spreman. Preuzmi ga na ovoj lokaciji tijekom odabranog termina.',
        },
        pickedUpAt: null,
    });
    const serialized = JSON.stringify(projected);
    assert.equal(serialized.includes(privateSentinel), false);
    for (const deliveryKey of [
        'tracking',
        'mapPath',
        'estimatedArrivalAt',
        'estimatedTravelSeconds',
        'estimatedDistanceMeters',
        'reroutePending',
        'recovery',
        'receipt',
        'deliveredAt',
        'eta',
        'progress',
    ]) {
        assert.equal(deliveryKey in projected, false, deliveryKey);
    }
});

test('does not expose a historical run path when delivery tracking is unavailable', () => {
    const historicalRun = 'PRIVATE HISTORICAL RUN 4135';
    const source: DeliveryStopSummary = {
        id: 41,
        requestId: 'request-history',
        sequence: 7,
        stopState: 'delivered',
        requestState: 'fulfilled',
        statusLabel: 'Dostavljeno',
        isCurrent: false,
        contactName: 'Kupac',
        phone: null,
        address: 'Adresa kupca',
        addressLabel: null,
        requestNotes: null,
        deliveryNotes: null,
        slotStartAt: '2026-07-16T10:00:00.000Z',
        slotEndAt: '2026-07-16T12:00:00.000Z',
        estimatedArrivalAt: null,
        estimatedTravelSeconds: null,
        estimatedDistanceMeters: null,
        reroutePending: false,
        arrivedAt: '2026-07-16T10:20:00.000Z',
        deliveredAt: '2026-07-16T10:25:00.000Z',
        harvest,
        receipt: null,
        recovery: null,
        tracking: null,
        runId: historicalRun,
        deliveryCount: 1,
        deliveries: [],
    };

    const projected = customerDeliveryRequestSummary(source, {
        now: '2026-07-16T12:30:00.000Z',
        runState: 'completed',
        stopsAhead: null,
        estimatesCalculatedAt: null,
        estimateSource: null,
        routePlanVersion: 1,
        hasTrafficRouteArtifact: false,
        trackingStatus: null,
        trackingLastAcceptedAt: null,
    });

    assert.equal(projected.mapPath, null);
    assert.equal(JSON.stringify(projected).includes(historicalRun), false);
});

test('uses pickup-safe copy for every request state', () => {
    assert.deepEqual(
        [
            'pending',
            'confirmed',
            'preparing',
            'ready',
            'fulfilled',
            'deferred',
            'failed',
            'cancelled',
        ].map(customerPickupStatusLabel),
        [
            'Čeka potvrdu',
            'Preuzimanje potvrđeno',
            'Urod se priprema',
            'Spremno za preuzimanje',
            'Preuzeto',
            'Preuzimanje je odgođeno',
            'Preuzimanje trenutačno nije moguće',
            'Preuzimanje je otkazano',
        ],
    );
    assert.equal(
        customerPickupInstructions('confirmed'),
        'Pričekaj status „Spremno za preuzimanje” prije dolaska.',
    );
});

test('derives a server-authoritative customer lifecycle when progress fails closed', () => {
    assert.equal(
        customerDeliveryLifecycle({
            requestState: 'ready',
            runState: 'active',
            deliveredAt: null,
            recovery: null,
        }),
        'active',
    );
    assert.equal(
        customerDeliveryLifecycle({
            requestState: 'failed',
            runState: 'active',
            deliveredAt: null,
            recovery: {
                kind: 'hq-pickup',
                pickupAddress: 'Gredice HQ',
                pickupDeadlineAt: '2026-07-19T10:00:00.000Z',
                pickupWindowHours: 72,
            },
        }),
        'upcoming',
    );
    assert.equal(
        customerDeliveryLifecycle({
            requestState: 'fulfilled',
            runState: 'active',
            deliveredAt: '2026-07-16T10:00:00.000Z',
            recovery: null,
        }),
        'history',
    );
    assert.equal(
        customerPickupLifecycle({ status: 'ready', pickedUpAt: null }),
        'upcoming',
    );
    assert.equal(
        customerPickupLifecycle({
            status: 'ready',
            pickedUpAt: '2026-07-16T10:00:00.000Z',
        }),
        'history',
    );
});
