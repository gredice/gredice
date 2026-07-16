import assert from 'node:assert/strict';
import test from 'node:test';
import {
    accountCanTrackCurrentDeliveryGroup,
    customerDeliveryReceiptSummary,
    customerDeliveryStopsAhead,
    deliveryDashboardKindForRole,
    deliveryMutationRouteState,
    deliveryProgressMilestoneOccurredAt,
    deliveryRecipientCount,
    deliveryStatusLabel,
    deliveryTrackingStopIds,
    expandLegacyCurrentDeliveryStopIds,
    isolateCustomerDeliveryPostCommitNotification,
    pickupManifestTracePath,
    recordedExceptionNeedsReroute,
    visibleDeliveryNotes,
    visibleDeliveryRunTotals,
    visibleDeliveryStopEstimates,
} from './deliveryDashboard';

test('route progress cannot occur before refreshed estimates', () => {
    const refreshedAt = new Date('2026-07-16T10:00:02.000Z');
    assert.deepEqual(
        deliveryProgressMilestoneOccurredAt({
            acceptedAt: new Date('2026-07-16T10:00:00.000Z'),
            estimatesUpdatedAt: refreshedAt,
            observedAt: new Date('2026-07-16T10:00:01.000Z'),
        }),
        refreshedAt,
    );
});

test('post-commit notification failures are isolated from driver mutations', async () => {
    const failures: unknown[] = [];
    const completed = await isolateCustomerDeliveryPostCommitNotification(
        async () => {
            throw new Error('notification read unavailable');
        },
        (error) => failures.push(error),
    );

    assert.equal(completed, false);
    assert.equal(failures.length, 1);
    assert.match(String(failures[0]), /notification read unavailable/u);
});

const pending = 'pending';
const delivered = 'delivered';

test('counts actionable recipients by stable server identity', () => {
    assert.equal(
        deliveryRecipientCount([
            {
                requestId: 'harvest-1',
                recipientIdentity: 71,
                actionable: true,
            },
            {
                requestId: 'harvest-2',
                recipientIdentity: 71,
                actionable: true,
            },
            {
                requestId: 'terminal-history',
                recipientIdentity: 99,
                actionable: false,
            },
        ]),
        1,
    );
});

function group(
    items: Array<{
        id?: number;
        state: string;
        accountId?: string;
    }>,
) {
    return {
        items: items.map((item) => ({
            stop: { id: item.id, state: item.state },
            request: item.accountId ? { accountId: item.accountId } : undefined,
        })),
    };
}

test('customer map allows every account in the current bulk delivery group', () => {
    const groups = [
        group([
            { state: pending, accountId: 'account-1' },
            { state: pending, accountId: 'account-2' },
        ]),
        group([{ state: pending, accountId: 'account-3' }]),
    ];

    assert.equal(
        accountCanTrackCurrentDeliveryGroup({
            accountId: 'account-1',
            runState: 'active',
            groups,
        }),
        true,
    );
    assert.equal(
        accountCanTrackCurrentDeliveryGroup({
            accountId: 'account-2',
            runState: 'active',
            groups,
        }),
        true,
    );
});

test('customer map denies later stops and delivered earlier stops', () => {
    const groups = [
        group([{ state: delivered, accountId: 'account-1' }]),
        group([{ state: pending, accountId: 'account-2' }]),
        group([{ state: pending, accountId: 'account-3' }]),
    ];

    assert.equal(
        accountCanTrackCurrentDeliveryGroup({
            accountId: 'account-1',
            runState: 'active',
            groups,
        }),
        false,
    );
    assert.equal(
        accountCanTrackCurrentDeliveryGroup({
            accountId: 'account-2',
            runState: 'active',
            groups,
        }),
        true,
    );
    assert.equal(
        accountCanTrackCurrentDeliveryGroup({
            accountId: 'account-3',
            runState: 'active',
            groups,
        }),
        false,
    );
});

test('customer map denies tracking when the delivery run is not active', () => {
    assert.equal(
        accountCanTrackCurrentDeliveryGroup({
            accountId: 'account-1',
            runState: 'completed',
            groups: [group([{ state: pending, accountId: 'account-1' }])],
        }),
        false,
    );
});

test('customer map denies tracking while a pickup checkpoint is current', () => {
    assert.equal(
        accountCanTrackCurrentDeliveryGroup({
            accountId: 'account-1',
            runState: 'active',
            groups: [
                group([{ id: 11, state: pending, accountId: 'account-1' }]),
            ],
            currentDeliveryStopIds: null,
        }),
        false,
    );
});

test('customer map allows only accounts in the server-confirmed current delivery checkpoint', () => {
    const groups = [
        group([{ id: 11, state: pending, accountId: 'account-1' }]),
        group([
            { id: 21, state: pending, accountId: 'account-2' },
            { id: 22, state: pending, accountId: 'account-3' },
        ]),
    ];
    const currentDeliveryStopIds = new Set([21, 22]);

    assert.equal(
        accountCanTrackCurrentDeliveryGroup({
            accountId: 'account-1',
            runState: 'active',
            groups,
            currentDeliveryStopIds,
        }),
        false,
    );
    assert.equal(
        accountCanTrackCurrentDeliveryGroup({
            accountId: 'account-3',
            runState: 'active',
            groups,
            currentDeliveryStopIds,
        }),
        true,
    );
});

test('legacy current delivery expands to every stop in the bulk group', () => {
    const currentStopIds = expandLegacyCurrentDeliveryStopIds({
        currentStopIds: new Set([21]),
        groups: [
            group([{ id: 11, state: pending, accountId: 'account-1' }]),
            group([
                { id: 21, state: pending, accountId: 'account-2' },
                { id: 22, state: pending, accountId: 'account-3' },
            ]),
        ],
    });

    assert.deepEqual(
        [...currentStopIds].sort((a, b) => a - b),
        [21, 22],
    );
});

test('legacy current delivery keeps the execution stop when its group cannot be resolved', () => {
    const currentStopIds = expandLegacyCurrentDeliveryStopIds({
        currentStopIds: new Set([21]),
        groups: [group([{ id: 11, state: pending, accountId: 'account-1' }])],
    });

    assert.deepEqual([...currentStopIds], [21]);
});

test('legacy route tracking authorizes every account in the current bulk group', () => {
    const groups = [
        group([{ id: 11, state: pending, accountId: 'account-1' }]),
        group([
            { id: 21, state: pending, accountId: 'account-2' },
            { id: 22, state: pending, accountId: 'account-3' },
        ]),
    ];
    const currentDeliveryStopIds = deliveryTrackingStopIds({
        routePlanVersion: 1,
        currentStopIds: new Set([21]),
        groups,
    });

    assert.equal(
        accountCanTrackCurrentDeliveryGroup({
            accountId: 'account-3',
            runState: 'active',
            groups,
            currentDeliveryStopIds,
        }),
        true,
    );
});

test('current route tracking keeps the server-confirmed physical stop ids', () => {
    const groups = [
        group([
            { id: 21, state: pending, accountId: 'account-2' },
            { id: 22, state: pending, accountId: 'account-3' },
        ]),
    ];

    assert.deepEqual(
        [
            ...deliveryTrackingStopIds({
                routePlanVersion: 2,
                currentStopIds: new Set([21]),
                groups,
            }),
        ],
        [21],
    );
});

test('customer progress counts unfinished physical checkpoints without splitting bulk stops', () => {
    const progress = [
        {
            kind: 'pickup' as const,
            pickupNodeId: 'completed-pickup',
            itinerarySequence: 1,
            manifestIds: ['manifest-completed'],
            state: 'completed' as const,
        },
        {
            kind: 'pickup' as const,
            pickupNodeId: 'current-pickup',
            itinerarySequence: 2,
            manifestIds: ['manifest-current'],
            state: 'current' as const,
        },
        {
            kind: 'delivery' as const,
            itinerarySequence: 3,
            stopKey: 'PRIVATE BULK STOP',
            stopIds: [21, 22],
            actionableStopIds: [21, 22],
            pickupConfirmed: true,
            state: 'upcoming' as const,
        },
        {
            kind: 'delivery' as const,
            itinerarySequence: 4,
            stopKey: 'PRIVATE LATER STOP',
            stopIds: [31],
            actionableStopIds: [31],
            pickupConfirmed: true,
            state: 'upcoming' as const,
        },
    ];

    assert.equal(customerDeliveryStopsAhead({ progress, stopId: 21 }), 1);
    assert.equal(customerDeliveryStopsAhead({ progress, stopId: 22 }), 1);
    assert.equal(customerDeliveryStopsAhead({ progress, stopId: 31 }), 2);
});

test('customer progress treats the current stop as next and counts retry checkpoints once', () => {
    const progress = [
        {
            kind: 'delivery' as const,
            itinerarySequence: 4,
            stopKey: 'current',
            stopIds: [41],
            actionableStopIds: [41],
            pickupConfirmed: true,
            state: 'current' as const,
        },
        {
            kind: 'delivery' as const,
            itinerarySequence: 5,
            stopKey: 'retry-bulk',
            stopIds: [51, 52],
            actionableStopIds: [51, 52],
            pickupConfirmed: true,
            retryLaneRank: 1,
            retryAttempt: 1,
            state: 'upcoming' as const,
        },
    ];

    assert.equal(customerDeliveryStopsAhead({ progress, stopId: 41 }), 0);
    assert.equal(customerDeliveryStopsAhead({ progress, stopId: 51 }), 1);
    assert.equal(customerDeliveryStopsAhead({ progress, stopId: 52 }), 1);
});

test('customer progress is unavailable for completed, unknown, or missing stops', () => {
    const progress = [
        {
            kind: 'delivery' as const,
            itinerarySequence: 1,
            stopKey: 'completed',
            stopIds: [61],
            actionableStopIds: [],
            pickupConfirmed: true,
            state: 'completed' as const,
        },
    ];

    assert.equal(customerDeliveryStopsAhead({ progress, stopId: 61 }), null);
    assert.equal(customerDeliveryStopsAhead({ progress, stopId: 99 }), null);
    assert.equal(customerDeliveryStopsAhead({ progress, stopId: null }), null);
});

test('pickup manifest advertises only persisted trace provenance', () => {
    assert.equal(
        pickupManifestTracePath('persisted-token'),
        '/trag/persisted-token',
    );
    assert.equal(pickupManifestTracePath(null), null);
});

test('customer delivery labels describe exceptions without operational details', () => {
    const privateOperationalContext = {
        reason: 'address-inaccessible',
        note: 'Privatna napomena za dispečera',
        recordedByUserId: 'private-driver-id',
    };
    const labels = [
        deliveryStatusLabel({
            requestState: 'ready',
            stopState: 'deferred',
            isCurrent: false,
            runState: 'active',
        }),
        deliveryStatusLabel({
            requestState: 'ready',
            stopState: 'failed',
            isCurrent: false,
            runState: 'active',
        }),
        deliveryStatusLabel({
            requestState: 'ready',
            stopState: 'cancelled',
            isCurrent: false,
            runState: 'active',
        }),
        deliveryStatusLabel({
            requestState: 'deferred',
            isCurrent: false,
        }),
        deliveryStatusLabel({
            requestState: 'failed',
            isCurrent: false,
        }),
        deliveryStatusLabel({
            requestState: 'cancelled',
            isCurrent: false,
        }),
    ];

    assert.deepEqual(labels, [
        'Dostava je odgođena',
        'Dostava nije uspjela',
        'Dostava je otkazana',
        'Dostava je odgođena',
        'Dostava nije uspjela',
        'Otkazano',
    ]);
    for (const detail of Object.values(privateOperationalContext)) {
        assert.ok(!labels.join(' ').includes(detail));
    }
});

test('customer exception stop state overrides fulfilled request state in a mixed bulk group', () => {
    assert.equal(
        deliveryStatusLabel({
            requestState: 'fulfilled',
            stopState: 'failed',
            isCurrent: false,
            runState: 'completed',
        }),
        'Dostava nije uspjela',
    );
    assert.equal(
        deliveryStatusLabel({
            requestState: 'fulfilled',
            stopState: 'cancelled',
            isCurrent: false,
            runState: 'completed',
        }),
        'Dostava je otkazana',
    );
});

test('partial bulk tracking authorizes only exact current actionable stop ids', () => {
    const groups = [
        group([
            { id: 21, state: 'deferred', accountId: 'account-deferred' },
            { id: 22, state: pending, accountId: 'account-current' },
            { id: 23, state: 'failed', accountId: 'account-failed' },
        ]),
    ];
    const currentDeliveryStopIds = deliveryTrackingStopIds({
        routePlanVersion: 2,
        currentStopIds: new Set([22]),
        groups,
    });

    assert.deepEqual([...currentDeliveryStopIds], [22]);
    assert.equal(
        accountCanTrackCurrentDeliveryGroup({
            accountId: 'account-current',
            runState: 'active',
            groups,
            currentDeliveryStopIds,
        }),
        true,
    );
    assert.equal(
        accountCanTrackCurrentDeliveryGroup({
            accountId: 'account-deferred',
            runState: 'active',
            groups,
            currentDeliveryStopIds,
        }),
        false,
    );
    assert.equal(
        accountCanTrackCurrentDeliveryGroup({
            accountId: 'account-failed',
            runState: 'active',
            groups,
            currentDeliveryStopIds,
        }),
        false,
    );
});

test('pending reroutes suppress stale customer arrival and travel estimates', () => {
    const previousEstimate = {
        estimatedArrivalAt: new Date('2026-07-15T10:00:00.000Z'),
        estimatedTravelSeconds: 600,
        estimatedDistanceMeters: 4_000,
    };
    assert.deepEqual(
        visibleDeliveryStopEstimates({
            reroutePending: true,
            ...previousEstimate,
        }),
        {
            estimatedArrivalAt: null,
            estimatedTravelSeconds: null,
            estimatedDistanceMeters: null,
        },
    );
    assert.deepEqual(
        visibleDeliveryRunTotals({
            reroutePending: true,
            totalDistanceMeters: 4_000,
            totalDurationSeconds: 600,
        }),
        { totalDistanceMeters: null, totalDurationSeconds: null },
    );
    assert.deepEqual(
        visibleDeliveryStopEstimates({
            reroutePending: false,
            ...previousEstimate,
        }),
        {
            estimatedArrivalAt: '2026-07-15T10:00:00.000Z',
            estimatedTravelSeconds: 600,
            estimatedDistanceMeters: 4_000,
        },
    );
});

test('customer dashboard serialization excludes driver delivery notes', () => {
    const sentinel = 'PRIVATE DRIVER DELIVERY NOTE';
    const customerProjection = {
        deliveryNotes: visibleDeliveryNotes('customer', sentinel),
        deliveries: [
            {
                deliveryNotes: visibleDeliveryNotes('customer', sentinel),
                exception: null,
            },
        ],
    };

    assert.equal(customerProjection.deliveryNotes, null);
    assert.equal(customerProjection.deliveries[0]?.deliveryNotes, null);
    assert.equal(JSON.stringify(customerProjection).includes(sentinel), false);
    assert.equal(visibleDeliveryNotes('driver', sentinel), sentinel);
});

test('customer receipt projection allowlists one completed request and harvest', () => {
    const privateRunId = 'PRIVATE RUN 4144';
    const privateStopId = 987_654_321;
    const privateOperationId = 'PRIVATE OPERATION 4144';
    const fulfilledAt = new Date('2026-07-16T10:30:00.000Z');
    const harvest = {
        plantName: 'Rajčica kupca',
        operationName: 'Berba',
        raisedBedName: 'Gredica 4',
        fieldName: 'Polje 2',
        tracePath: '/trag/customer-owned-4144',
    };
    const handoffReceipt = {
        fulfilledAt,
        verification: 'verified' as const,
        runId: privateRunId,
        stopId: privateStopId,
        clientOperationId: privateOperationId,
    };

    const receipt = customerDeliveryReceiptSummary({
        audience: 'customer',
        mode: 'delivery',
        requestState: 'fulfilled',
        requestId: 'customer-request-4144',
        handoffReceipt,
        harvest,
    });

    assert.deepEqual(receipt, {
        requestReference: 'customer-request-4144',
        deliveredAt: '2026-07-16T10:30:00.000Z',
        verification: 'verified',
        harvest,
    });
    const serialized = JSON.stringify(receipt);
    assert.equal(serialized.includes(privateRunId), false);
    assert.equal(serialized.includes(String(privateStopId)), false);
    assert.equal(serialized.includes(privateOperationId), false);
});

test('customer receipt projection excludes active and driver-facing requests', () => {
    const input = {
        requestId: 'customer-request-4144',
        handoffReceipt: {
            fulfilledAt: new Date('2026-07-16T10:30:00.000Z'),
            verification: 'not-recorded' as const,
        },
        harvest: {
            plantName: 'Rajčica kupca',
            operationName: null,
            raisedBedName: null,
            fieldName: null,
            tracePath: null,
        },
    };

    assert.equal(
        customerDeliveryReceiptSummary({
            ...input,
            audience: 'customer',
            mode: 'delivery',
            requestState: 'ready',
        }),
        null,
    );
    assert.equal(
        customerDeliveryReceiptSummary({
            ...input,
            audience: 'driver',
            mode: 'delivery',
            requestState: 'fulfilled',
        }),
        null,
    );
    assert.equal(
        customerDeliveryReceiptSummary({
            audience: 'customer',
            mode: 'delivery',
            requestState: 'fulfilled',
            requestId: input.requestId,
            harvest: input.harvest,
        }),
        null,
    );
    assert.equal(
        customerDeliveryReceiptSummary({
            ...input,
            audience: 'customer',
            mode: 'pickup',
            requestState: 'fulfilled',
        }),
        null,
    );
});

test('delivery dashboard roles fail closed and preserve customer role boundaries', () => {
    assert.equal(deliveryDashboardKindForRole('user'), 'customer');
    assert.equal(deliveryDashboardKindForRole('farmer'), 'customer');
    assert.equal(deliveryDashboardKindForRole('driver'), 'driver');
    assert.equal(deliveryDashboardKindForRole('admin'), 'driver');
    assert.equal(deliveryDashboardKindForRole('unknown'), null);
});

test('exception receipt replay returns current revision without rerouting a stale receipt', () => {
    assert.equal(
        recordedExceptionNeedsReroute({
            currentRouteRevision: 8,
            recordedRouteRevision: 7,
            reroutePending: false,
        }),
        false,
    );
    assert.deepEqual(
        deliveryMutationRouteState(
            { routeRevision: 8, rerouteRequiredAt: null },
            7,
        ),
        { routeRevision: 8, reroutePending: false, runCompleted: false },
    );
    assert.equal(
        recordedExceptionNeedsReroute({
            currentRouteRevision: 7,
            recordedRouteRevision: 7,
            reroutePending: true,
        }),
        true,
    );
});
