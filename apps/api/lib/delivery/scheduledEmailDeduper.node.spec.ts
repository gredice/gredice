import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    buildScheduledDeliveryEmailKey,
    notifyScheduledDeliveryEmailOnce,
} from './scheduledEmailDeduper';

describe('buildScheduledDeliveryEmailKey', () => {
    it('returns a stable key for one delivery slot and address', () => {
        const notificationKey = buildScheduledDeliveryEmailKey('account-1', {
            slotId: 12,
            mode: 'delivery',
            addressId: 34,
            notes: 'Leave at the gate',
        });

        assert.strictEqual(notificationKey, 'account-1|delivery|12|address:34');
    });

    it('skips non-delivery requests', () => {
        const notificationKey = buildScheduledDeliveryEmailKey('account-1', {
            slotId: 12,
            mode: 'pickup',
            locationId: 99,
        });

        assert.strictEqual(notificationKey, null);
    });
});

describe('notifyScheduledDeliveryEmailOnce', () => {
    it('sends only once for multiple items in the same slot', async () => {
        const requestIds: string[] = [];
        const notifiedKeys = new Set<string>();

        const notify = async (requestId: string) => {
            requestIds.push(requestId);
            return true;
        };

        await notifyScheduledDeliveryEmailOnce({
            requestId: 'request-1',
            accountId: 'account-1',
            deliveryInfo: {
                slotId: 12,
                mode: 'delivery',
                addressId: 34,
            },
            notifiedKeys,
            notify,
        });

        await notifyScheduledDeliveryEmailOnce({
            requestId: 'request-2',
            accountId: 'account-1',
            deliveryInfo: {
                slotId: 12,
                mode: 'delivery',
                addressId: 34,
            },
            notifiedKeys,
            notify,
        });

        assert.deepStrictEqual(requestIds, ['request-1']);
    });

    it('retries on the next request if the first send failed', async () => {
        const requestIds: string[] = [];
        const notifiedKeys = new Set<string>();

        const notify = async (requestId: string) => {
            requestIds.push(requestId);
            return requestIds.length > 1;
        };

        await notifyScheduledDeliveryEmailOnce({
            requestId: 'request-1',
            accountId: 'account-1',
            deliveryInfo: {
                slotId: 12,
                mode: 'delivery',
                addressId: 34,
            },
            notifiedKeys,
            notify,
        });

        await notifyScheduledDeliveryEmailOnce({
            requestId: 'request-2',
            accountId: 'account-1',
            deliveryInfo: {
                slotId: 12,
                mode: 'delivery',
                addressId: 34,
            },
            notifiedKeys,
            notify,
        });

        assert.deepStrictEqual(requestIds, ['request-1', 'request-2']);
    });

    it('sends again when the slot changes', async () => {
        const requestIds: string[] = [];
        const notifiedKeys = new Set<string>();

        const notify = async (requestId: string) => {
            requestIds.push(requestId);
            return true;
        };

        await notifyScheduledDeliveryEmailOnce({
            requestId: 'request-1',
            accountId: 'account-1',
            deliveryInfo: {
                slotId: 12,
                mode: 'delivery',
                addressId: 34,
            },
            notifiedKeys,
            notify,
        });

        await notifyScheduledDeliveryEmailOnce({
            requestId: 'request-2',
            accountId: 'account-1',
            deliveryInfo: {
                slotId: 13,
                mode: 'delivery',
                addressId: 34,
            },
            notifiedKeys,
            notify,
        });

        assert.deepStrictEqual(requestIds, ['request-1', 'request-2']);
    });
});
