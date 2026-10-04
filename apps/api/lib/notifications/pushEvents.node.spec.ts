import assert from 'node:assert/strict';
import test from 'node:test';
import {
    pushNotificationEventMetadata,
    pushNotificationEventSchema,
} from './pushEvents';

test('pushNotificationEventSchema accepts service-worker click events', () => {
    const result = pushNotificationEventSchema.safeParse({
        action: 'open-cart',
        at: '2026-05-20T11:30:00.000Z',
        category: 'general',
        deliveryAttemptId: 12,
        notificationId: 'notification-1',
        type: 'clicked',
    });

    assert.equal(result.success, true);
});

test('pushNotificationEventSchema rejects unsafe action keys', () => {
    const result = pushNotificationEventSchema.safeParse({
        action: '../admin',
        notificationId: 'notification-1',
        type: 'clicked',
    });

    assert.equal(result.success, false);
});

test('pushNotificationEventMetadata keeps only accepted fields', () => {
    const event = pushNotificationEventSchema.parse({
        action: 'open-cart',
        campaignId: 'campaign-1',
        category: 'general',
        notificationId: 'notification-1',
        type: 'clicked',
    });

    assert.deepEqual(pushNotificationEventMetadata(event), {
        action: 'open-cart',
        campaignId: 'campaign-1',
        category: 'general',
        source: 'service_worker',
    });
});
