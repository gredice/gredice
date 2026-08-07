import assert from 'node:assert/strict';
import test from 'node:test';
import {
    isStripeCheckoutProcessingMaintenanceEnabled,
    parseStripeCheckoutProcessingMaintenanceFlag,
} from './stripeCheckoutProcessingMaintenance';

const maintenanceEnvironmentKey =
    'GREDICE_STRIPE_CHECKOUT_PROCESSING_MAINTENANCE_ENABLED';

function setMaintenanceEnvironment(value: string | undefined) {
    if (value === undefined) {
        delete process.env[maintenanceEnvironmentKey];
        return;
    }
    process.env[maintenanceEnvironmentKey] = value;
}

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

test('durable Stripe claims are active unless maintenance is explicitly enabled', () => {
    const originalValue = process.env[maintenanceEnvironmentKey];
    try {
        for (const value of [undefined, '', '0', 'false', 'disabled']) {
            setMaintenanceEnvironment(value);
            assert.strictEqual(
                isStripeCheckoutProcessingMaintenanceEnabled(),
                false,
            );
        }

        for (const value of ['1', 'true', 'yes', 'on', 'enabled']) {
            setMaintenanceEnvironment(value);
            assert.strictEqual(
                isStripeCheckoutProcessingMaintenanceEnabled(),
                true,
            );
        }
    } finally {
        setMaintenanceEnvironment(originalValue);
    }
});
