import assert from 'node:assert/strict';
import test from 'node:test';
import {
    CheckoutOperationConflictError,
    StripePaymentProcessingPermanentError,
} from '@gredice/storage';
import { normalizeStripePaymentProcessingError } from './processCheckoutSession';

test('known operation date and fingerprint conflicts are permanent without leaking details', () => {
    for (const reason of [
        'Checkout operation scheduled date must be a valid Date.',
        'Checkout operation fingerprint conflicts on scheduledDate.',
        'Checkout operation mapping conflicts with the stored operation.',
    ]) {
        const normalized = normalizeStripePaymentProcessingError(
            new CheckoutOperationConflictError(reason),
        );
        assert.ok(normalized instanceof StripePaymentProcessingPermanentError);
        assert.equal(normalized.failureCode, 'checkout_operation_conflict');
        assert.ok(!normalized.message.includes(reason));
    }
});

test('arbitrary TypeError, transient database/provider/transport errors, and unknown failures retain retry classification', () => {
    for (const error of [
        new TypeError('unexpected shape'),
        Object.assign(new Error('database'), { code: '40001' }),
        Object.assign(new Error('transport'), { code: 'ECONNRESET' }),
        Object.assign(new Error('provider'), { status: 503 }),
        new Error('unknown'),
        null,
        { name: 'CheckoutOperationConflictError' },
    ]) {
        assert.equal(normalizeStripePaymentProcessingError(error), error);
    }
});
