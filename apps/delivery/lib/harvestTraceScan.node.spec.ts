import assert from 'node:assert/strict';
import test from 'node:test';
import type {
    DeliveryRouteOrderSummary,
    DeliveryStopDeliverySummary,
} from './deliveryDashboardTypes';
import {
    applyDeliveryRouteSelection,
    type DeliveryRouteSelectionCandidate,
} from './deliveryRouteSelection';
import {
    normalizeHarvestTraceScanValue,
    selectDeliveryStopFromHarvestTrace,
    verifyDeliveryStopHarvestTrace,
} from './harvestTraceScan';

const firstToken = 'first-valid-trace-token-2026';
const secondToken = 'second-valid-trace-token-2026';

function order({
    requestId,
    stopKey,
    token,
    readyForPickup = true,
}: {
    requestId: string;
    stopKey: string;
    token: string | null;
    readyForPickup?: boolean;
}): DeliveryRouteOrderSummary {
    return {
        requestId,
        stopKey,
        readyForPickup,
        pickupStatusLabel: readyForPickup
            ? 'Spremno za preuzimanje'
            : 'Još nije spremno za preuzimanje',
        contactName: `Kontakt ${requestId}`,
        address: 'Testna 1, Zagreb, HR',
        addressLabel: null,
        requestNotes: null,
        harvest: {
            plantName: `Biljka ${requestId}`,
            operationName: null,
            raisedBedName: null,
            fieldName: null,
            tracePath: token ? `/trag/${token}` : null,
        },
    };
}

function delivery({
    requestId,
    token,
}: {
    requestId: string;
    token: string | null;
}): DeliveryStopDeliverySummary {
    return {
        requestId,
        requestState: 'in_delivery',
        contactName: `Kontakt ${requestId}`,
        phone: null,
        addressLabel: null,
        requestNotes: null,
        deliveryNotes: null,
        harvest: {
            plantName: `Biljka ${requestId}`,
            operationName: null,
            raisedBedName: null,
            fieldName: null,
            tracePath: token ? `/trag/${token}` : null,
        },
        accountContacts: [],
    };
}

test('normalizes official harvest trace QR values', () => {
    assert.equal(
        normalizeHarvestTraceScanValue(
            `https://www.gredice.com/trag/${firstToken}?source=label#trace`,
        ),
        `/trag/${firstToken}`,
    );
    assert.equal(
        normalizeHarvestTraceScanValue(`/trag/${firstToken}`),
        `/trag/${firstToken}`,
    );
    assert.equal(
        normalizeHarvestTraceScanValue(`trag/${firstToken}`),
        `/trag/${firstToken}`,
    );
    assert.equal(
        normalizeHarvestTraceScanValue(firstToken),
        `/trag/${firstToken}`,
    );
});

test('rejects non-Gredice URLs and malformed trace values', () => {
    assert.equal(
        normalizeHarvestTraceScanValue(
            `https://example.com/trag/${firstToken}`,
        ),
        null,
    );
    assert.equal(
        normalizeHarvestTraceScanValue('https://www.gredice.com/drugo/token'),
        null,
    );
    assert.equal(normalizeHarvestTraceScanValue('kratko'), null);
});

test('selects every delivery in the scanned physical stop', () => {
    const orders = [
        order({ requestId: 'one', stopKey: 'slot:1', token: firstToken }),
        order({ requestId: 'two', stopKey: 'slot:1', token: secondToken }),
        order({ requestId: 'three', stopKey: 'slot:2', token: null }),
    ];

    const result = selectDeliveryStopFromHarvestTrace({
        orders,
        selectedRequestIds: [],
        maximumRouteStops: 26,
        scanValue: `https://www.gredice.com/trag/${firstToken}`,
    });

    assert.equal(result.status, 'selected');
    if (result.status !== 'selected') return;
    assert.deepEqual(result.nextSelectedRequestIds, ['one', 'two']);
    assert.equal(result.newlySelectedCount, 2);
    assert.equal(result.deliveryCount, 2);
});

test('allows scanning another harvest at an already selected stop at the route limit', () => {
    const orders = [
        order({ requestId: 'one', stopKey: 'slot:1', token: firstToken }),
        order({ requestId: 'two', stopKey: 'slot:1', token: secondToken }),
    ];

    const result = selectDeliveryStopFromHarvestTrace({
        orders,
        selectedRequestIds: ['one'],
        maximumRouteStops: 1,
        scanValue: secondToken,
    });

    assert.equal(result.status, 'selected');
    if (result.status !== 'selected') return;
    assert.deepEqual(result.nextSelectedRequestIds, ['one', 'two']);
    assert.equal(result.newlySelectedCount, 1);
});

test('does not select harvests that are not ready for HQ pickup', () => {
    const orders = [
        order({ requestId: 'ready', stopKey: 'slot:1', token: firstToken }),
        order({
            requestId: 'not-ready',
            stopKey: 'slot:1',
            token: secondToken,
            readyForPickup: false,
        }),
        order({ requestId: 'ready-two', stopKey: 'slot:1', token: null }),
    ];

    const readyResult = selectDeliveryStopFromHarvestTrace({
        orders,
        selectedRequestIds: [],
        maximumRouteStops: 1,
        scanValue: firstToken,
    });
    assert.equal(readyResult.status, 'selected');
    if (readyResult.status !== 'selected') return;
    assert.deepEqual(readyResult.nextSelectedRequestIds, [
        'ready',
        'ready-two',
    ]);

    assert.equal(
        selectDeliveryStopFromHarvestTrace({
            orders,
            selectedRequestIds: readyResult.nextSelectedRequestIds,
            maximumRouteStops: 1,
            scanValue: secondToken,
        }).status,
        'not-ready',
    );
});

test('accumulates delivery stops across consecutive live scans', () => {
    const orders = [
        order({ requestId: 'one', stopKey: 'slot:1', token: firstToken }),
        order({ requestId: 'two', stopKey: 'slot:1', token: null }),
        order({ requestId: 'three', stopKey: 'slot:2', token: secondToken }),
    ];

    const firstResult = selectDeliveryStopFromHarvestTrace({
        orders,
        selectedRequestIds: [],
        maximumRouteStops: 2,
        scanValue: firstToken,
    });
    assert.equal(firstResult.status, 'selected');
    if (firstResult.status !== 'selected') return;

    const secondResult = selectDeliveryStopFromHarvestTrace({
        orders,
        selectedRequestIds: firstResult.nextSelectedRequestIds,
        maximumRouteStops: 2,
        scanValue: secondToken,
    });
    assert.equal(secondResult.status, 'selected');
    if (secondResult.status !== 'selected') return;
    assert.deepEqual(secondResult.nextSelectedRequestIds, [
        'one',
        'two',
        'three',
    ]);
});

test('keeps the current QR selection when a live scan belongs to another pickup location', () => {
    const orders = [
        order({ requestId: 'one', stopKey: 'slot:1', token: firstToken }),
        order({ requestId: 'two', stopKey: 'slot:2', token: secondToken }),
    ];
    const candidates: DeliveryRouteSelectionCandidate[] = [
        {
            requestId: 'one',
            stopKey: 'slot:1',
            readyForPickup: true,
            pickupLocationId: 1,
            pickupLocationName: 'Sjedište',
            pickupAddress: 'Prva 1, Zagreb',
            slotId: 1,
            slotStartAt: '2026-07-15T08:00:00.000Z',
            slotEndAt: '2026-07-15T10:00:00.000Z',
            deliveryAddress: 'Kupac 1, Zagreb',
        },
        {
            requestId: 'two',
            stopKey: 'slot:2',
            readyForPickup: true,
            pickupLocationId: 2,
            pickupLocationName: 'Drugo skladište',
            pickupAddress: 'Druga 2, Zagreb',
            slotId: 2,
            slotStartAt: '2026-07-15T08:00:00.000Z',
            slotEndAt: '2026-07-15T10:00:00.000Z',
            deliveryAddress: 'Kupac 2, Zagreb',
        },
    ];
    const firstScan = selectDeliveryStopFromHarvestTrace({
        orders,
        selectedRequestIds: [],
        maximumRouteStops: 26,
        scanValue: firstToken,
    });
    assert.equal(firstScan.status, 'selected');
    if (firstScan.status !== 'selected') return;
    const firstSelection = applyDeliveryRouteSelection({
        candidates,
        currentRequestIds: [],
        nextRequestIds: firstScan.nextSelectedRequestIds,
        maximumRouteStops: 26,
        maximumRouteWindowHours: 24,
    });
    assert.equal(firstSelection.status, 'accepted');
    if (firstSelection.status !== 'accepted') return;

    const secondScan = selectDeliveryStopFromHarvestTrace({
        orders,
        selectedRequestIds: firstSelection.requestIds,
        maximumRouteStops: 26,
        scanValue: secondToken,
    });
    assert.equal(secondScan.status, 'selected');
    if (secondScan.status !== 'selected') return;
    const secondSelection = applyDeliveryRouteSelection({
        candidates,
        currentRequestIds: firstSelection.requestIds,
        nextRequestIds: secondScan.nextSelectedRequestIds,
        maximumRouteStops: 26,
        maximumRouteWindowHours: 24,
    });

    assert.equal(secondSelection.status, 'rejected');
    if (secondSelection.status !== 'rejected') return;
    assert.equal(secondSelection.conflict.code, 'mixed-pickup-locations');
    assert.deepEqual(secondSelection.requestIds, ['one']);
});

test('reports duplicate, unavailable, ambiguous, and route-limit scans', () => {
    const orders = [
        order({ requestId: 'one', stopKey: 'slot:1', token: firstToken }),
        order({ requestId: 'two', stopKey: 'slot:2', token: secondToken }),
    ];

    assert.equal(
        selectDeliveryStopFromHarvestTrace({
            orders,
            selectedRequestIds: ['one'],
            maximumRouteStops: 2,
            scanValue: firstToken,
        }).status,
        'already-selected',
    );
    assert.equal(
        selectDeliveryStopFromHarvestTrace({
            orders,
            selectedRequestIds: [],
            maximumRouteStops: 2,
            scanValue: 'unavailable-valid-trace-token',
        }).status,
        'not-found',
    );
    assert.equal(
        selectDeliveryStopFromHarvestTrace({
            orders,
            selectedRequestIds: ['one'],
            maximumRouteStops: 1,
            scanValue: secondToken,
        }).status,
        'limit-reached',
    );

    const ambiguousOrders = [
        order({ requestId: 'one', stopKey: 'slot:1', token: firstToken }),
        order({ requestId: 'two', stopKey: 'slot:2', token: firstToken }),
    ];
    assert.equal(
        selectDeliveryStopFromHarvestTrace({
            orders: ambiguousOrders,
            selectedRequestIds: [],
            maximumRouteStops: 2,
            scanValue: firstToken,
        }).status,
        'ambiguous',
    );
});

test('accumulates optional delivery verification scans for the current stop', () => {
    const deliveries = [
        delivery({ requestId: 'one', token: firstToken }),
        delivery({ requestId: 'two', token: secondToken }),
        delivery({ requestId: 'without-code', token: null }),
    ];

    const firstResult = verifyDeliveryStopHarvestTrace({
        deliveries,
        verifiedTracePaths: [],
        scanValue: firstToken,
    });
    assert.equal(firstResult.status, 'verified');
    if (firstResult.status !== 'verified') return;
    assert.deepEqual(firstResult.nextVerifiedTracePaths, [
        `/trag/${firstToken}`,
    ]);

    const secondResult = verifyDeliveryStopHarvestTrace({
        deliveries,
        verifiedTracePaths: firstResult.nextVerifiedTracePaths,
        scanValue: `https://www.gredice.com/trag/${secondToken}`,
    });
    assert.equal(secondResult.status, 'verified');
    if (secondResult.status !== 'verified') return;
    assert.deepEqual(secondResult.nextVerifiedTracePaths, [
        `/trag/${firstToken}`,
        `/trag/${secondToken}`,
    ]);
});

test('reports repeated, invalid, and wrong-stop verification scans without blocking delivery', () => {
    const deliveries = [delivery({ requestId: 'one', token: firstToken })];

    assert.equal(
        verifyDeliveryStopHarvestTrace({
            deliveries,
            verifiedTracePaths: [`/trag/${firstToken}`],
            scanValue: firstToken,
        }).status,
        'already-verified',
    );
    assert.equal(
        verifyDeliveryStopHarvestTrace({
            deliveries,
            verifiedTracePaths: [],
            scanValue: secondToken,
        }).status,
        'not-at-stop',
    );
    assert.equal(
        verifyDeliveryStopHarvestTrace({
            deliveries,
            verifiedTracePaths: [],
            scanValue: 'nije-qr-kod',
        }).status,
        'verification-invalid',
    );
});
