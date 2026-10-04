import assert from 'node:assert/strict';
import test from 'node:test';
import { notificationPreferencesWritable } from './notificationRollout';

test('delivery channel preferences stay writable when premium controls are disabled', () => {
    assert.equal(
        notificationPreferencesWritable({
            preferences: [
                { category: 'delivery_updates', channel: 'in_app' },
                { category: 'delivery_updates', channel: 'email' },
                { category: 'delivery_updates', channel: 'push' },
            ],
            premiumControlsEnabled: false,
        }),
        true,
    );
    assert.equal(
        notificationPreferencesWritable({
            preferences: [
                { category: 'delivery_updates', channel: 'email' },
                { category: 'garden', channel: 'push' },
            ],
            premiumControlsEnabled: false,
        }),
        false,
    );
    assert.equal(
        notificationPreferencesWritable({
            preferences: [{ category: 'delivery_updates', channel: 'sms' }],
            premiumControlsEnabled: false,
        }),
        false,
    );
    assert.equal(
        notificationPreferencesWritable({
            preferences: [{ category: 'garden', channel: 'push' }],
            premiumControlsEnabled: true,
        }),
        true,
    );
});
