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
    assert.deepEqual(
        result.summary.slots.map((slot) => slot.id),
        [10, 11],
    );
    assert.equal(result.summary.windowStartAt, earlyStart);
    assert.equal(result.summary.windowEndAt, '2026-07-15T14:00:00.000Z');
    assert.equal(result.summary.windowSpanMinutes, 360);
});

test('mixed pickup locations reject the attempted manual change and preserve current IDs', () => {
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

    assert.equal(result.status, 'rejected');
    assert.deepEqual(result.requestIds, ['selected']);
    assert.deepEqual(result.summary.requestIds, ['selected']);
    assert.equal(result.conflict.code, 'mixed-pickup-locations');
    assert.deepEqual(result.conflict.conflictingRequestIds, ['other-location']);
    assert.deepEqual(
        result.conflict.pickupLocations.map((location) => ({
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
    assert.deepEqual(result.conflict.separateRouteRequestIds, ['selected']);
    assert.match(result.conflict.message, /Istočno skladište/);
});

test('batch selection rejects mixed-location additions atomically', () => {
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

    assert.equal(result.status, 'rejected');
    assert.deepEqual(result.requestIds, ['current']);
    assert.deepEqual(result.conflict.conflictingRequestIds, [
        'batch-one',
        'batch-two',
    ]);
    assert.deepEqual(result.conflict.separateRouteRequestIds, ['current']);
});

test('select-all conflict returns the same deterministic compatible suggestion', () => {
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

    assert.equal(first.conflict?.code, 'mixed-pickup-locations');
    assert.deepEqual(first.conflict?.separateRouteRequestIds, [
        'hq-one',
        'hq-two',
    ]);
    assert.deepEqual(
        second.conflict?.separateRouteRequestIds,
        first.conflict?.separateRouteRequestIds,
    );
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
    assert.deepEqual(result.summary.pickupLocations, []);
    assert.deepEqual(result.summary.slots, []);
    assert.equal(result.summary.windowStartAt, null);
    assert.equal(result.summary.windowEndAt, null);
    assert.equal(result.summary.windowSpanMinutes, 0);
});

test('QR-proposed IDs use the same atomic mixed-location guard', () => {
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

    assert.equal(secondScan.status, 'rejected');
    assert.deepEqual(secondScan.requestIds, ['scanned-first', 'first-sibling']);
    assert.equal(secondScan.conflict.code, 'mixed-pickup-locations');
    assert.deepEqual(secondScan.conflict.conflictingRequestIds, [
        'scanned-remote',
        'remote-sibling',
    ]);
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
