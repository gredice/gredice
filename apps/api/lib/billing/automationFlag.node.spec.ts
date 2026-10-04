import assert from 'node:assert/strict';
import test from 'node:test';
import {
    billingAutomationFlagName,
    isBillingAutomationEnabled,
    parseBillingAutomationFlag,
} from './automationFlag';

function withBillingFlag(value: string | undefined, callback: () => void) {
    const previousValue = process.env[billingAutomationFlagName];

    if (typeof value === 'string') {
        process.env[billingAutomationFlagName] = value;
    } else {
        delete process.env[billingAutomationFlagName];
    }

    try {
        callback();
    } finally {
        if (typeof previousValue === 'string') {
            process.env[billingAutomationFlagName] = previousValue;
        } else {
            delete process.env[billingAutomationFlagName];
        }
    }
}

test('parseBillingAutomationFlag enables explicit truthy values', () => {
    for (const value of ['1', 'true', 'TRUE', 'yes', 'on', 'enabled']) {
        assert.equal(parseBillingAutomationFlag(value), true);
    }
});

test('parseBillingAutomationFlag defaults unset, falsey, and invalid values off', () => {
    for (const value of [undefined, '', '0', 'false', 'off', 'invalid']) {
        assert.equal(parseBillingAutomationFlag(value), false);
    }
});

test('isBillingAutomationEnabled reads the central environment flag', () => {
    withBillingFlag('true', () => {
        assert.equal(isBillingAutomationEnabled(), true);
    });
    withBillingFlag('false', () => {
        assert.equal(isBillingAutomationEnabled(), false);
    });
    withBillingFlag(undefined, () => {
        assert.equal(isBillingAutomationEnabled(), false);
    });
});
