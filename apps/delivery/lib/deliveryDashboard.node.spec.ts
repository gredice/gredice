import assert from 'node:assert/strict';
import test from 'node:test';
import { accountCanTrackCurrentDeliveryGroup } from './deliveryDashboard';

const pending = 'pending';
const delivered = 'delivered';

function group(
    items: Array<{
        state: string;
        accountId?: string;
    }>,
) {
    return {
        items: items.map((item) => ({
            stop: { state: item.state },
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
