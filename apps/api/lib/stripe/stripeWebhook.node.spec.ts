import assert from 'node:assert/strict';
import test from 'node:test';
import {
    StripePaymentProcessingPermanentError,
    StripePaymentProcessingUnavailableError,
} from '@gredice/storage';
import { handleStripeWebhook } from './stripeWebhook';

function webhookRequest() {
    return new Request('https://api.gredice.com/api/stripe/webhook', {
        body: '{"signed":true}',
        headers: { 'stripe-signature': 'signed-header' },
        method: 'POST',
    });
}

function completedPaymentEvent() {
    return {
        data: { object: { id: 'cs_paid', mode: 'payment' } },
        type: 'checkout.session.completed',
    };
}

function expiredPaymentEvent() {
    return {
        data: {
            object: {
                id: 'cs_expired',
                metadata: {
                    checkoutAttemptId: 'attempt-1',
                    checkoutCartId: '42',
                    checkoutSnapshotVersion: '1',
                },
                mode: 'payment',
            },
        },
        type: 'checkout.session.expired',
    };
}

test('valid signed payment webhook returns retryable 503 during maintenance', async (t) => {
    t.mock.method(console, 'warn', () => undefined);
    let constructed = 0;
    let processed = 0;
    const response = await handleStripeWebhook(webhookRequest(), {
        constructEvent: async (body, signature) => {
            constructed += 1;
            assert.strictEqual(body, '{"signed":true}');
            assert.strictEqual(signature, 'signed-header');
            return completedPaymentEvent();
        },
        maintenanceEnabled: () => true,
        process: async () => {
            processed += 1;
        },
    });

    assert.strictEqual(constructed, 1);
    assert.strictEqual(processed, 0);
    assert.strictEqual(response.status, 503);
    assert.strictEqual(response.headers.get('retry-after'), '60');
    assert.strictEqual(
        response.headers.get('cache-control'),
        'private, no-store',
    );
    assert.deepStrictEqual(await response.json(), {
        maintenance: true,
        success: false,
    });
});

test('payment webhook resumes processing when maintenance is disabled', async () => {
    const processed: string[] = [];
    const response = await handleStripeWebhook(webhookRequest(), {
        constructEvent: async () => completedPaymentEvent(),
        maintenanceEnabled: () => false,
        process: async (checkoutSessionId) => {
            if (checkoutSessionId) processed.push(checkoutSessionId);
        },
    });

    assert.strictEqual(response.status, 200);
    assert.deepStrictEqual(processed, ['cs_paid']);
    assert.deepStrictEqual(await response.json(), { received: true });
});

test('invalid signature fails before maintenance and processing checks', async (t) => {
    t.mock.method(console, 'error', () => undefined);
    let downstreamCalls = 0;
    const response = await handleStripeWebhook(webhookRequest(), {
        constructEvent: async () => {
            throw new Error('invalid signature');
        },
        maintenanceEnabled: () => {
            downstreamCalls += 1;
            return true;
        },
        process: async () => {
            downstreamCalls += 1;
        },
    });

    assert.strictEqual(response.status, 400);
    assert.strictEqual(downstreamCalls, 0);
});

test('unsupported signed webhook remains a 400 during maintenance', async () => {
    let maintenanceChecks = 0;
    const response = await handleStripeWebhook(webhookRequest(), {
        constructEvent: async () => ({
            data: { object: {} },
            type: 'customer.created',
        }),
        maintenanceEnabled: () => {
            maintenanceChecks += 1;
            return true;
        },
    });

    assert.strictEqual(response.status, 400);
    assert.strictEqual(maintenanceChecks, 0);
});

test('payment webhook retryable processing failures return 503 for Stripe retry', async (t) => {
    t.mock.method(console, 'error', () => undefined);
    const response = await handleStripeWebhook(webhookRequest(), {
        constructEvent: async () => completedPaymentEvent(),
        maintenanceEnabled: () => false,
        process: async () => {
            throw new Error('fulfillment failed');
        },
    });

    assert.strictEqual(response.status, 503);
    assert.strictEqual(response.headers.get('retry-after'), '60');
    assert.strictEqual(await response.text(), 'Stripe webhook handler failed');
});

test('payment webhook returns 503 while another worker owns the retryable claim', async (t) => {
    t.mock.method(console, 'warn', () => undefined);
    const response = await handleStripeWebhook(webhookRequest(), {
        constructEvent: async () => completedPaymentEvent(),
        maintenanceEnabled: () => false,
        process: async () => {
            throw new StripePaymentProcessingUnavailableError(
                'cs_paid',
                'processing',
                new Date('2026-08-04T10:01:00.000Z'),
                2,
            );
        },
    });

    assert.strictEqual(response.status, 503);
    assert.strictEqual(response.headers.get('retry-after'), '60');
    assert.strictEqual(await response.text(), 'Stripe webhook handler failed');
});

test('durably classified permanent payment failures are acknowledged', async (t) => {
    t.mock.method(console, 'error', () => undefined);
    const response = await handleStripeWebhook(webhookRequest(), {
        constructEvent: async () => completedPaymentEvent(),
        maintenanceEnabled: () => false,
        process: async () => {
            throw new StripePaymentProcessingPermanentError(
                'checkout_session_unpaid',
            );
        },
    });

    assert.strictEqual(response.status, 200);
    assert.strictEqual(
        response.headers.get('cache-control'),
        'private, no-store',
    );
    assert.deepStrictEqual(await response.json(), { received: true });
});

test('signed expired checkout releases its attempt even during maintenance', async () => {
    let maintenanceChecks = 0;
    const released: unknown[] = [];
    const response = await handleStripeWebhook(webhookRequest(), {
        constructEvent: async () => expiredPaymentEvent(),
        maintenanceEnabled: () => {
            maintenanceChecks += 1;
            return true;
        },
        releaseAttempt: async (input) => {
            released.push(input);
        },
    });

    assert.strictEqual(response.status, 200);
    assert.strictEqual(maintenanceChecks, 0);
    assert.deepStrictEqual(released, [
        {
            attemptId: 'attempt-1',
            cartId: 42,
            reason: 'expired',
            sessionId: 'cs_expired',
        },
    ]);
});

test('expired checkout release failures remain retryable', async (t) => {
    t.mock.method(console, 'error', () => undefined);
    const response = await handleStripeWebhook(webhookRequest(), {
        constructEvent: async () => expiredPaymentEvent(),
        releaseAttempt: async () => {
            throw new Error('database unavailable');
        },
    });

    assert.strictEqual(response.status, 503);
    assert.strictEqual(response.headers.get('retry-after'), '60');
});
