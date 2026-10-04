import assert from 'node:assert/strict';
import test from 'node:test';
import { buildStripeCheckoutSessionCreateParams } from '@gredice/stripe/server';

test('new Stripe Checkout sessions use only synchronous card payments', () => {
    const params = buildStripeCheckoutSessionCreateParams({
        customerId: 'cus_test',
        data: {
            items: [
                {
                    price: { currency: 'eur', valueInCents: 499 },
                    product: { name: 'Test checkout item' },
                    quantity: 1,
                },
            ],
        },
        returnUrls: {
            cancel: 'https://vrt.gredice.com/placanje?status=cancel',
            success: 'https://vrt.gredice.com/placanje?status=success',
        },
    });

    assert.deepStrictEqual(params.payment_method_types, ['card']);
    assert.strictEqual(params.mode, 'payment');
});
