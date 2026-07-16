import assert from 'node:assert/strict';
import test from 'node:test';
import {
    customerDeliveryInitialHistoryCount,
    organizeCustomerDeliverySections,
} from './customerDeliverySections';
import type {
    CustomerDeliveryDashboardRequest,
    CustomerDeliveryProgressSummary,
    CustomerDeliveryRequestSummary,
    CustomerPickupRequestSummary,
} from './deliveryDashboardTypes';

const harvest = {
    plantName: 'Rajčica',
    operationName: 'Berba',
    raisedBedName: 'Gredica 4',
    fieldName: 'Polje 2',
    tracePath: '/trag/customer-owned',
};

function delivery({
    requestId,
    status = 'confirmed',
    lifecycle = 'upcoming',
    phase = 'scheduled',
    stopsAhead = null,
    slotStartAt = '2026-07-16T10:00:00.000Z',
    slotEndAt = '2026-07-16T12:00:00.000Z',
    deliveredAt = null,
    recovery = null,
}: {
    requestId: string;
    status?: string;
    lifecycle?: CustomerDeliveryRequestSummary['lifecycle'];
    phase?: CustomerDeliveryProgressSummary['phase'];
    stopsAhead?: number | null;
    slotStartAt?: string | null;
    slotEndAt?: string | null;
    deliveredAt?: string | null;
    recovery?: CustomerDeliveryRequestSummary['recovery'];
}): CustomerDeliveryRequestSummary {
    return {
        mode: 'delivery',
        requestId,
        status,
        lifecycle,
        statusLabel: status,
        requestNotes: null,
        slotStartAt,
        slotEndAt,
        eta: {
            source: 'promised-window',
            calculatedAt: null,
            freshness: 'fallback',
            confidence: 'approximate',
            rangeStartAt: slotStartAt,
            rangeEndAt: slotEndAt,
            remainingMinSeconds: null,
            remainingMaxSeconds: null,
        },
        progress: { phase, stopsAhead, delayed: false },
        deliveredAt,
        harvest,
        destination: {
            recipientName: 'Kupac',
            address: 'Vrtna 1, 10000 Zagreb, HR',
            addressLabel: 'Dom',
        },
        receipt: null,
        recovery,
        tracking: null,
        mapPath: null,
    };
}

function pickup({
    requestId,
    status = 'confirmed',
    lifecycle = 'upcoming',
    slotStartAt = '2026-07-16T10:00:00.000Z',
    slotEndAt = '2026-07-16T12:00:00.000Z',
    pickedUpAt = null,
}: {
    requestId: string;
    status?: string;
    lifecycle?: CustomerPickupRequestSummary['lifecycle'];
    slotStartAt?: string | null;
    slotEndAt?: string | null;
    pickedUpAt?: string | null;
}): CustomerPickupRequestSummary {
    return {
        mode: 'pickup',
        requestId,
        status,
        lifecycle,
        statusLabel: status,
        requestNotes: null,
        slotStartAt,
        slotEndAt,
        harvest,
        location: null,
        pickedUpAt,
    };
}

function requestIds(requests: readonly CustomerDeliveryDashboardRequest[]) {
    return requests.map(({ requestId }) => requestId);
}

test('organizes mixed delivery and pickup requests by lifecycle and time', () => {
    const requests = [
        delivery({
            requestId: 'upcoming-delivery-later',
            slotStartAt: '2026-07-16T14:00:00.000Z',
        }),
        pickup({
            requestId: 'history-pickup',
            status: 'fulfilled',
            lifecycle: 'history',
            pickedUpAt: '2026-07-16T11:30:00.000Z',
        }),
        delivery({
            requestId: 'active-delivery',
            status: 'ready',
            lifecycle: 'active',
            phase: 'next',
            stopsAhead: 0,
        }),
        pickup({
            requestId: 'upcoming-pickup-first',
            status: 'ready',
            slotStartAt: '2026-07-16T09:00:00.000Z',
        }),
        delivery({
            requestId: 'history-delivery',
            status: 'fulfilled',
            lifecycle: 'history',
            deliveredAt: '2026-07-16T10:30:00.000Z',
        }),
        delivery({
            requestId: 'history-failed',
            status: 'failed',
            lifecycle: 'history',
            phase: 'arrived',
            slotStartAt: '2026-07-16T08:00:00.000Z',
            recovery: { kind: 'support' },
        }),
    ];

    const sections = organizeCustomerDeliverySections(requests);

    assert.deepEqual(requestIds(sections.active), ['active-delivery']);
    assert.deepEqual(requestIds(sections.upcoming), [
        'upcoming-pickup-first',
        'upcoming-delivery-later',
    ]);
    assert.deepEqual(requestIds(sections.history), [
        'history-failed',
        'history-pickup',
        'history-delivery',
    ]);
    assert.equal(customerDeliveryInitialHistoryCount, 6);
});

test('uses the server lifecycle without inferring sections from request status', () => {
    const sections = organizeCustomerDeliverySections([
        delivery({
            requestId: 'fulfilled-but-upcoming',
            status: 'fulfilled',
            lifecycle: 'upcoming',
        }),
        delivery({
            requestId: 'ready-but-history',
            status: 'ready',
            lifecycle: 'history',
        }),
        delivery({
            requestId: 'failed-but-active',
            status: 'failed',
            lifecycle: 'active',
            phase: 'unavailable',
        }),
    ]);

    assert.deepEqual(requestIds(sections.active), ['failed-but-active']);
    assert.deepEqual(requestIds(sections.upcoming), ['fulfilled-but-upcoming']);
    assert.deepEqual(requestIds(sections.history), ['ready-but-history']);
});

test('keeps multiple active bulk requests and orders active phases and progress', () => {
    const requests = [
        delivery({
            requestId: 'bulk-second',
            status: 'ready',
            lifecycle: 'active',
            phase: 'on-route',
            stopsAhead: 2,
        }),
        delivery({
            requestId: 'on-route-unknown',
            status: 'ready',
            lifecycle: 'active',
            phase: 'on-route',
            stopsAhead: null,
        }),
        delivery({
            requestId: 'next',
            status: 'ready',
            lifecycle: 'active',
            phase: 'next',
            stopsAhead: 0,
        }),
        delivery({
            requestId: 'bulk-first',
            status: 'ready',
            lifecycle: 'active',
            phase: 'on-route',
            stopsAhead: 2,
        }),
        delivery({
            requestId: 'arrived',
            status: 'ready',
            lifecycle: 'active',
            phase: 'arrived',
            stopsAhead: 0,
        }),
        delivery({
            requestId: 'on-route-first',
            status: 'ready',
            lifecycle: 'active',
            phase: 'on-route',
            stopsAhead: 1,
        }),
        delivery({
            requestId: 'active-unavailable',
            status: 'ready',
            lifecycle: 'active',
            phase: 'unavailable',
            stopsAhead: null,
        }),
    ];

    const sections = organizeCustomerDeliverySections(requests);

    assert.deepEqual(requestIds(sections.active), [
        'arrived',
        'next',
        'on-route-first',
        'bulk-second',
        'bulk-first',
        'on-route-unknown',
        'active-unavailable',
    ]);
    assert.equal(sections.active.length, requests.length);
});

test('fails malformed and null dates to the end without changing stable ties', () => {
    const requests = [
        pickup({
            requestId: 'upcoming-invalid-first',
            slotStartAt: 'not-a-date',
            slotEndAt: null,
        }),
        delivery({
            requestId: 'history-invalid-first',
            status: 'cancelled',
            lifecycle: 'history',
            deliveredAt: '2026-02-31T10:00:00.000Z',
            slotStartAt: null,
            slotEndAt: null,
        }),
        delivery({
            requestId: 'upcoming-later',
            slotStartAt: '2026-07-16T12:00:00.000Z',
        }),
        pickup({
            requestId: 'history-slot-fallback',
            status: 'failed',
            lifecycle: 'history',
            pickedUpAt: 'invalid',
            slotStartAt: '2026-07-16T13:00:00.000Z',
        }),
        pickup({
            requestId: 'upcoming-null-second',
            slotStartAt: null,
            slotEndAt: null,
        }),
        delivery({
            requestId: 'history-completed',
            status: 'fulfilled',
            lifecycle: 'history',
            deliveredAt: '2026-07-16T14:00:00.000Z',
        }),
        delivery({
            requestId: 'upcoming-earlier',
            slotStartAt: '2026-07-16T09:00:00.000Z',
        }),
        pickup({
            requestId: 'history-null-second',
            status: 'fulfilled',
            lifecycle: 'history',
            pickedUpAt: null,
            slotStartAt: null,
            slotEndAt: null,
        }),
    ];
    const originalOrder = requestIds(requests);

    const sections = organizeCustomerDeliverySections(requests);

    assert.deepEqual(requestIds(sections.upcoming), [
        'upcoming-earlier',
        'upcoming-later',
        'upcoming-invalid-first',
        'upcoming-null-second',
    ]);
    assert.deepEqual(requestIds(sections.history), [
        'history-completed',
        'history-slot-fallback',
        'history-invalid-first',
        'history-null-second',
    ]);
    assert.deepEqual(requestIds(requests), originalOrder);
});

test('preserves input order when every section sort key ties', () => {
    const requests = [
        delivery({
            requestId: 'active-a',
            status: 'ready',
            lifecycle: 'active',
            phase: 'on-route',
            stopsAhead: 3,
        }),
        delivery({
            requestId: 'active-b',
            status: 'ready',
            lifecycle: 'active',
            phase: 'on-route',
            stopsAhead: 3,
        }),
        pickup({ requestId: 'upcoming-a' }),
        delivery({ requestId: 'upcoming-b' }),
        delivery({
            requestId: 'history-a',
            status: 'fulfilled',
            lifecycle: 'history',
            deliveredAt: '2026-07-16T11:00:00.000Z',
        }),
        pickup({
            requestId: 'history-b',
            status: 'fulfilled',
            lifecycle: 'history',
            pickedUpAt: '2026-07-16T11:00:00.000Z',
        }),
    ];

    const sections = organizeCustomerDeliverySections(requests);

    assert.deepEqual(requestIds(sections.active), ['active-a', 'active-b']);
    assert.deepEqual(requestIds(sections.upcoming), [
        'upcoming-a',
        'upcoming-b',
    ]);
    assert.deepEqual(requestIds(sections.history), ['history-a', 'history-b']);
});
