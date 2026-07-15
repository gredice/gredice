import assert from 'node:assert/strict';
import test from 'node:test';
import {
    applyDeliveryRouteSelection,
    type DeliveryRouteSelectionCandidate,
    inspectDeliveryRouteSelection,
} from './deliveryRouteSelection';

const earlyStart = '2026-07-15T08:00:00.000Z';
const earlyEnd = '2026-07-15T10:00:00.000Z';

function candidate({
    requestId,
    stopKey = `stop:${requestId}`,
    readyForPickup = true,
    pickupLocationId = 1,
    pickupLocationName = 'Glavno sjedište',
    pickupAddress = 'Ulica Julija Knifera 3, Zagreb',
    slotId = 10,
    slotStartAt = earlyStart,
    slotEndAt = earlyEnd,
    deliveryAddress = `Adresa ${requestId}`,
}: {
    requestId: string;
    stopKey?: string;
    readyForPickup?: boolean;
    pickupLocationId?: number;
    pickupLocationName?: string | null;
    pickupAddress?: string | null;
    slotId?: number;
    slotStartAt?: string;
    slotEndAt?: string;
    deliveryAddress?: string;
}): DeliveryRouteSelectionCandidate {
    return {
        requestId,
        stopKey,
        readyForPickup,
        pickupLocationId,
        pickupLocationName,
        pickupAddress,
        slotId,
        slotStartAt,
        slotEndAt,
        deliveryAddress,
    };
}

function apply({
    candidates,
    currentRequestIds = [],
    nextRequestIds,
    maximumRouteStops = 26,
    maximumRouteWindowHours = 24,
}: {
    candidates: DeliveryRouteSelectionCandidate[];
    currentRequestIds?: string[];
    nextRequestIds: string[];
    maximumRouteStops?: number;
    maximumRouteWindowHours?: number;
}) {
    return applyDeliveryRouteSelection({
        candidates,
        currentRequestIds,
        nextRequestIds,
        maximumRouteStops,
        maximumRouteWindowHours,
    });
}

test('manual bulk selection keeps every ready harvest at one physical stop', () => {
    const candidates = [
        candidate({ requestId: 'bulk-one', stopKey: 'bulk-stop' }),
        candidate({ requestId: 'bulk-two', stopKey: 'bulk-stop' }),
        candidate({
            requestId: 'bulk-not-ready',
            stopKey: 'bulk-stop',
            readyForPickup: false,
        }),
    ];

    const result = apply({
        candidates,
        nextRequestIds: ['bulk-one', 'bulk-two', 'bulk-not-ready'],
    });

    assert.equal(result.status, 'accepted');
    assert.deepEqual(result.requestIds, ['bulk-one', 'bulk-two']);
    assert.equal(result.summary.deliveryCount, 2);
    assert.equal(result.summary.stopCount, 1);
    assert.equal(result.summary.routeNodeCount, 2);
    assert.deepEqual(result.summary.pickupLocations[0]?.requestIds, [
        'bulk-one',
        'bulk-two',
    ]);
});

test('same-location selections across compatible slots are accepted and summarized', () => {
    const candidates = [
        candidate({ requestId: 'morning', slotId: 10 }),
        candidate({
            requestId: 'afternoon',
            slotId: 11,
            slotStartAt: '2026-07-15T12:00:00.000Z',
            slotEndAt: '2026-07-15T14:00:00.000Z',
        }),
    ];

    const result = apply({
        candidates,
        currentRequestIds: ['morning'],
        nextRequestIds: ['morning', 'afternoon'],
    });

    assert.equal(result.status, 'accepted');
    assert.deepEqual(result.requestIds, ['morning', 'afternoon']);
    assert.equal(result.summary.pickupLocations.length, 1);
    assert.equal(result.summary.routeNodeCount, 3);
    assert.deepEqual(
        result.summary.slots.map((slot) => slot.id),
        [10, 11],
    );
    assert.equal(result.summary.windowStartAt, earlyStart);
    assert.equal(result.summary.windowEndAt, '2026-07-15T14:00:00.000Z');
    assert.equal(result.summary.windowSpanMinutes, 360);
});

test('mixed pickup locations are accepted and included in the route-node summary', () => {
    const candidates = [
        candidate({ requestId: 'selected' }),
        candidate({
            requestId: 'other-location',
            pickupLocationId: 2,
            pickupLocationName: 'Istočno skladište',
            pickupAddress: 'Druga 2, Zagreb',
            slotId: 20,
        }),
    ];

    const result = apply({
        candidates,
        currentRequestIds: ['selected'],
        nextRequestIds: ['selected', 'other-location'],
    });

    assert.equal(result.status, 'accepted');
    assert.deepEqual(result.requestIds, ['selected', 'other-location']);
    assert.equal(result.summary.stopCount, 2);
    assert.equal(result.summary.routeNodeCount, 4);
    assert.deepEqual(
        result.summary.pickupLocations.map((location) => ({
            id: location.id,
            name: location.name,
            address: location.address,
        })),
        [
            {
                id: 1,
                name: 'Glavno sjedište',
                address: 'Ulica Julija Knifera 3, Zagreb',
            },
            {
                id: 2,
                name: 'Istočno skladište',
                address: 'Druga 2, Zagreb',
            },
        ],
    );
});

test('batch selection accepts additions from another pickup location atomically', () => {
    const candidates = [
        candidate({ requestId: 'current', stopKey: 'current-stop' }),
        candidate({
            requestId: 'batch-one',
            stopKey: 'batch-stop-one',
            pickupLocationId: 2,
            pickupLocationName: 'Zapadno skladište',
            slotId: 20,
        }),
        candidate({
            requestId: 'batch-two',
            stopKey: 'batch-stop-two',
            pickupLocationId: 2,
            pickupLocationName: 'Zapadno skladište',
            slotId: 20,
        }),
    ];

    const result = apply({
        candidates,
        currentRequestIds: ['current'],
        nextRequestIds: ['current', 'batch-one', 'batch-two'],
    });

    assert.equal(result.status, 'accepted');
    assert.deepEqual(result.requestIds, ['current', 'batch-one', 'batch-two']);
    assert.equal(result.summary.pickupLocations.length, 2);
    assert.equal(result.summary.routeNodeCount, 5);
});

test('select-all across pickup locations is accepted deterministically', () => {
    const candidates = [
        candidate({ requestId: 'hq-one', stopKey: 'hq-bulk' }),
        candidate({ requestId: 'hq-two', stopKey: 'hq-bulk' }),
        candidate({
            requestId: 'remote-one',
            pickupLocationId: 2,
            pickupLocationName: 'Druga lokacija',
            slotId: 20,
        }),
        candidate({
            requestId: 'remote-two',
            pickupLocationId: 2,
            pickupLocationName: 'Druga lokacija',
            slotId: 20,
        }),
    ];
    const requestIds = candidates.map(({ requestId }) => requestId);

    const first = inspectDeliveryRouteSelection({
        candidates,
        requestIds,
        maximumRouteStops: 26,
        maximumRouteWindowHours: 24,
    });
    const second = inspectDeliveryRouteSelection({
        candidates,
        requestIds,
        maximumRouteStops: 26,
        maximumRouteWindowHours: 24,
    });

    assert.equal(first.conflict, null);
    assert.equal(second.conflict, null);
    assert.deepEqual(first.summary.requestIds, requestIds);
    assert.deepEqual(second.summary.requestIds, requestIds);
    assert.equal(first.summary.routeNodeCount, 5);
});

test('a selection spanning more than 24 hours is rejected with its conflicting slot', () => {
    const candidates = [
        candidate({ requestId: 'first-slot', slotId: 10 }),
        candidate({
            requestId: 'late-slot-one',
            stopKey: 'late-bulk',
            slotId: 11,
            slotStartAt: '2026-07-16T10:00:01.000Z',
            slotEndAt: '2026-07-16T12:00:01.000Z',
        }),
        candidate({
            requestId: 'late-slot-two',
            stopKey: 'late-bulk',
            slotId: 11,
            slotStartAt: '2026-07-16T10:00:01.000Z',
            slotEndAt: '2026-07-16T12:00:01.000Z',
        }),
    ];

    const result = apply({
        candidates,
        currentRequestIds: ['first-slot'],
        nextRequestIds: ['first-slot', 'late-slot-one', 'late-slot-two'],
    });

    assert.equal(result.status, 'rejected');
    assert.deepEqual(result.requestIds, ['first-slot']);
    assert.equal(result.conflict.code, 'route-window-span-exceeded');
    assert.deepEqual(result.conflict.conflictingRequestIds, [
        'late-slot-one',
        'late-slot-two',
    ]);
    assert.deepEqual(result.conflict.separateRouteRequestIds, ['first-slot']);
    assert.equal(result.conflict.deliveryAddress, 'Adresa late-slot-one');
});

test('an earlier attempted slot is identified instead of blaming the current later slot', () => {
    const candidates = [
        candidate({
            requestId: 'current-late',
            slotId: 20,
            slotStartAt: '2026-07-16T10:00:01.000Z',
            slotEndAt: '2026-07-16T12:00:01.000Z',
        }),
        candidate({
            requestId: 'attempted-early',
            slotId: 10,
            slotStartAt: earlyStart,
            slotEndAt: earlyEnd,
        }),
    ];

    const result = apply({
        candidates,
        currentRequestIds: ['current-late'],
        nextRequestIds: ['current-late', 'attempted-early'],
    });

    assert.equal(result.status, 'rejected');
    assert.deepEqual(result.requestIds, ['current-late']);
    assert.deepEqual(result.conflict.conflictingRequestIds, [
        'attempted-early',
    ]);
    assert.equal(result.conflict.deliveryAddress, 'Adresa attempted-early');
    assert.match(result.conflict.message, /Dodani termin/);
    assert.deepEqual(result.conflict.separateRouteRequestIds, ['current-late']);
});

test('physical-stop limits count a bulk address once and reject only the excess group', () => {
    const candidates = [
        candidate({ requestId: 'bulk-one', stopKey: 'bulk-stop' }),
        candidate({ requestId: 'bulk-two', stopKey: 'bulk-stop' }),
        candidate({ requestId: 'second-stop', stopKey: 'second-stop' }),
        candidate({ requestId: 'third-one', stopKey: 'third-stop' }),
        candidate({ requestId: 'third-two', stopKey: 'third-stop' }),
    ];

    const accepted = apply({
        candidates,
        nextRequestIds: ['bulk-one', 'bulk-two', 'second-stop'],
        maximumRouteStops: 2,
    });
    assert.equal(accepted.status, 'accepted');
    assert.equal(accepted.summary.deliveryCount, 3);
    assert.equal(accepted.summary.stopCount, 2);
    assert.equal(accepted.summary.routeNodeCount, 3);

    const rejected = apply({
        candidates,
        currentRequestIds: accepted.requestIds,
        nextRequestIds: [
            'bulk-one',
            'bulk-two',
            'second-stop',
            'third-one',
            'third-two',
        ],
        maximumRouteStops: 2,
    });
    assert.equal(rejected.status, 'rejected');
    assert.deepEqual(rejected.requestIds, [
        'bulk-one',
        'bulk-two',
        'second-stop',
    ]);
    assert.equal(rejected.conflict.code, 'route-stop-limit-exceeded');
    assert.deepEqual(rejected.conflict.conflictingRequestIds, [
        'third-one',
        'third-two',
    ]);
    assert.deepEqual(rejected.conflict.separateRouteRequestIds, [
        'bulk-one',
        'bulk-two',
        'second-stop',
    ]);
});

test('route validation accepts 27 physical nodes and rejects the 28th', () => {
    const candidates = Array.from({ length: 26 }, (_, index) =>
        candidate({
            requestId: `delivery-${index + 1}`,
            stopKey: `stop-${index + 1}`,
            pickupLocationId: index === 24 ? 2 : 1,
            pickupLocationName:
                index === 24 ? 'Drugo skladište' : 'Glavno sjedište',
            pickupAddress:
                index === 24
                    ? 'Druga 2, Zagreb'
                    : 'Ulica Julija Knifera 3, Zagreb',
            slotId: index === 24 ? 20 : 10,
        }),
    );
    const acceptedRequestIds = candidates
        .slice(0, 25)
        .map(({ requestId }) => requestId);

    const accepted = apply({
        candidates,
        nextRequestIds: acceptedRequestIds,
    });
    assert.equal(accepted.status, 'accepted');
    assert.equal(accepted.summary.stopCount, 25);
    assert.equal(accepted.summary.pickupLocations.length, 2);
    assert.equal(accepted.summary.routeNodeCount, 27);

    const rejected = apply({
        candidates,
        currentRequestIds: acceptedRequestIds,
        nextRequestIds: candidates.map(({ requestId }) => requestId),
    });
    assert.equal(rejected.status, 'rejected');
    if (rejected.status !== 'rejected') return;
    assert.equal(rejected.summary.routeNodeCount, 27);
    assert.equal(rejected.conflict.code, 'route-stop-limit-exceeded');
    assert.deepEqual(rejected.conflict.conflictingRequestIds, ['delivery-26']);
    assert.deepEqual(
        rejected.conflict.separateRouteRequestIds,
        acceptedRequestIds,
    );
    assert.match(rejected.conflict.message, /27 fizičkih lokacija/);
});

test('stale, duplicate, and no-longer-ready request IDs are pruned', () => {
    const candidates = [
        candidate({ requestId: 'ready' }),
        candidate({ requestId: 'not-ready', readyForPickup: false }),
    ];

    const result = apply({
        candidates,
        currentRequestIds: ['stale-current'],
        nextRequestIds: ['stale-next', 'ready', 'ready', 'not-ready'],
    });

    assert.equal(result.status, 'accepted');
    assert.deepEqual(result.requestIds, ['ready']);
    assert.deepEqual(result.summary.requestIds, ['ready']);
});

test('reset accepts an empty replacement and clears all summary counts', () => {
    const candidates = [candidate({ requestId: 'selected' })];

    const result = apply({
        candidates,
        currentRequestIds: ['selected'],
        nextRequestIds: [],
    });

    assert.equal(result.status, 'accepted');
    assert.deepEqual(result.requestIds, []);
    assert.equal(result.summary.deliveryCount, 0);
    assert.equal(result.summary.stopCount, 0);
    assert.equal(result.summary.routeNodeCount, 0);
    assert.deepEqual(result.summary.pickupLocations, []);
    assert.deepEqual(result.summary.slots, []);
    assert.equal(result.summary.windowStartAt, null);
    assert.equal(result.summary.windowEndAt, null);
    assert.equal(result.summary.windowSpanMinutes, 0);
});

test('QR-proposed IDs accumulate atomically across pickup locations', () => {
    const candidates = [
        candidate({ requestId: 'scanned-first', stopKey: 'first-bulk' }),
        candidate({ requestId: 'first-sibling', stopKey: 'first-bulk' }),
        candidate({
            requestId: 'scanned-remote',
            stopKey: 'remote-bulk',
            pickupLocationId: 2,
            pickupLocationName: 'QR lokacija',
            slotId: 20,
        }),
        candidate({
            requestId: 'remote-sibling',
            stopKey: 'remote-bulk',
            pickupLocationId: 2,
            pickupLocationName: 'QR lokacija',
            slotId: 20,
        }),
    ];

    const firstScan = apply({
        candidates,
        nextRequestIds: ['scanned-first', 'first-sibling'],
    });
    assert.equal(firstScan.status, 'accepted');

    const secondScan = apply({
        candidates,
        currentRequestIds: firstScan.requestIds,
        nextRequestIds: [
            ...firstScan.requestIds,
            'scanned-remote',
            'remote-sibling',
        ],
    });

    assert.equal(secondScan.status, 'accepted');
    assert.deepEqual(secondScan.requestIds, [
        'scanned-first',
        'first-sibling',
        'scanned-remote',
        'remote-sibling',
    ]);
    assert.equal(secondScan.summary.stopCount, 2);
    assert.equal(secondScan.summary.pickupLocations.length, 2);
    assert.equal(secondScan.summary.routeNodeCount, 4);
});

test('invalid delivery windows report the exact request and address', () => {
    const candidates = [
        candidate({
            requestId: 'invalid-window',
            slotStartAt: 'not-a-date',
            slotEndAt: earlyEnd,
            deliveryAddress: 'Neispravna 1',
        }),
    ];

    const result = apply({
        candidates,
        currentRequestIds: [],
        nextRequestIds: ['invalid-window'],
    });

    assert.equal(result.status, 'rejected');
    assert.deepEqual(result.requestIds, []);
    assert.equal(result.conflict.code, 'delivery-window-invalid');
    assert.deepEqual(result.conflict.conflictingRequestIds, ['invalid-window']);
    assert.equal(result.conflict.deliveryAddress, 'Neispravna 1');
    assert.deepEqual(result.conflict.separateRouteRequestIds, []);
});
