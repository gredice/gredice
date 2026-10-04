import assert from 'node:assert/strict';
import test from 'node:test';
import { getStripeOperationalErrorDiagnostic } from './stripeOperationalError';

test('Stripe operational diagnostics keep bounded names and provider codes', () => {
    const error = Object.assign(new Error('sensitive detail'), {
        code: 'connection_timeout',
    });

    assert.deepStrictEqual(getStripeOperationalErrorDiagnostic(error), {
        errorCode: 'connection_timeout',
        errorName: 'Error',
    });
});

test('Stripe operational diagnostics omit unbounded values and error messages', () => {
    const error = Object.assign(new Error('do not log this'), {
        code: 'unsafe code with spaces',
        name: 'unsafe name with spaces',
    });

    assert.deepStrictEqual(getStripeOperationalErrorDiagnostic(error), {
        errorCode: undefined,
        errorName: 'Unknown',
    });
});
