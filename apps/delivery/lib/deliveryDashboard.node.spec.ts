import assert from 'node:assert/strict';
import test from 'node:test';
import {
    accountCanTrackCurrentDeliveryGroup,
    deliveryStatusLabel,
    deliveryTrackingStopIds,
    expandLegacyCurrentDeliveryStopIds,
    pickupManifestTracePath,
} from './deliveryDashboard';

const pending = 'pending';
const delivered = 'delivered';

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
