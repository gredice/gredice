import assert from 'node:assert/strict';
import test from 'node:test';
import { deliveryAndroidAutoEnabled } from './deliveryAndroidAutoFlag';

test('delivery Android Auto is fail-closed unless explicitly enabled', () => {
    for (const value of [undefined, '', 'false', '1', 'yes', 'enabled']) {
        assert.equal(deliveryAndroidAutoEnabled(value), false, String(value));
    }
});

test('delivery Android Auto accepts only the explicit true value', () => {
    for (const value of ['true', ' TRUE ', 'True']) {
        assert.equal(deliveryAndroidAutoEnabled(value), true, value);
    }
});
