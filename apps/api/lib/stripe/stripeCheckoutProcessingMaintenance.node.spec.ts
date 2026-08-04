import assert from 'node:assert/strict';
import test from 'node:test';
import {
    isStripeCheckoutProcessingMaintenanceEnabled,
    parseStripeCheckoutProcessingMaintenanceFlag,
    stripeCheckoutClaimCutoverMaintenanceDefault,
} from './stripeCheckoutProcessingMaintenance';

test('Stripe checkout maintenance flag accepts only documented truthy values', () => {
    for (const value of ['1', 'true', 'yes', 'on', 'enabled', ' TRUE ']) {
        assert.strictEqual(
            parseStripeCheckoutProcessingMaintenanceFlag(value),
            true,
        );
    }
    for (const value of [undefined, '', '0', 'false', 'disabled', 'random']) {
        assert.strictEqual(
            parseStripeCheckoutProcessingMaintenanceFlag(value),
            false,
        );
    }
});

test('claim cutover prerequisite forces maintenance on until activation', () => {
    assert.strictEqual(stripeCheckoutClaimCutoverMaintenanceDefault, true);
    assert.strictEqual(isStripeCheckoutProcessingMaintenanceEnabled(), true);
});
