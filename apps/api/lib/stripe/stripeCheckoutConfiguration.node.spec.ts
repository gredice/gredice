import assert from 'node:assert/strict';
import test from 'node:test';
import {
    buildStripeCheckoutSessionCreateParams,
    stripeCheckout,
} from '@gredice/stripe/server';
import { getStripe } from '../../../../packages/stripe/src/lib/config';

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

    assert.deepStrictEqual(params.allowed_payment_method_types, ['card']);
    assert.strictEqual('payment_method_types' in params, false);
    assert.strictEqual(params.mode, 'payment');
});

test('Stripe 23 sends the card-only filter with checkout recovery settings', async (t) => {
    const previousSecretKey = process.env.STRIPE_SECRETKEY;
    process.env.STRIPE_SECRETKEY = 'sk_test_checkout_configuration';
    t.after(() => {
        if (previousSecretKey === undefined) {
            delete process.env.STRIPE_SECRETKEY;
        } else {
            process.env.STRIPE_SECRETKEY = previousSecretKey;
        }
    });

    const stripe = getStripe();
    const httpClient = stripe.getApiField('httpClient');
    const makeRequest = async (
        _host: string,
        _port: number,
        path: string,
        method: string,
        headers: Record<string, unknown>,
        requestData: string,
    ) => {
        assert.strictEqual(path, '/v1/checkout/sessions');
        assert.strictEqual(method, 'POST');
        assert.strictEqual(headers['Stripe-Version'], '2026-09-30.endive');
        assert.strictEqual(headers['Idempotency-Key'], 'checkout_attempt_test');

        const body = new URLSearchParams(requestData);
        assert.deepStrictEqual(
            [...body.entries()].filter(([key]) =>
                key.startsWith('allowed_payment_method_types'),
            ),
            [['allowed_payment_method_types[0]', 'card']],
        );
        assert.strictEqual(
            [...body.keys()].some((key) =>
                key.startsWith('payment_method_types'),
            ),
            false,
        );
        assert.strictEqual(body.get('mode'), 'payment');
        assert.strictEqual(body.get('customer'), 'cus_test');
        assert.strictEqual(body.get('allow_promotion_codes'), 'false');
        assert.strictEqual(body.get('expires_at'), '1791374400');
        assert.strictEqual(body.get('metadata[cartId]'), 'cart_test');
        assert.strictEqual(
            body.get('line_items[0][price_data][unit_amount]'),
            '499',
        );
        assert.strictEqual(
            body.get('success_url'),
            'https://vrt.gredice.com/placanje?status=success',
        );
        assert.strictEqual(
            body.get('cancel_url'),
            'https://vrt.gredice.com/placanje?status=cancel',
        );

        return {
            getStatusCode: () => 200,
            getHeaders: () => ({}),
            getRawResponse: () => ({}),
            toStream: () => undefined,
            toJSON: async () => ({
                id: 'cs_test',
                object: 'checkout.session',
                url: 'https://checkout.stripe.com/test',
            }),
        };
    };
    const httpRequest = t.mock.method(httpClient, 'makeRequest', makeRequest);

    const result = await stripeCheckout(
        { id: 'account_test', email: 'test@example.com', name: 'Test' },
        {
            items: [
                {
                    price: { currency: 'eur', valueInCents: 499 },
                    product: { name: 'Test checkout item' },
                    quantity: 1,
                },
            ],
            allowPromotionCodes: false,
            expiresAt: new Date('2026-10-07T12:00:00.000Z'),
            metadata: { cartId: 'cart_test' },
        },
        {
            customerId: 'cus_test',
            idempotencyKey: 'checkout_attempt_test',
            returnUrls: {
                cancel: 'https://vrt.gredice.com/placanje?status=cancel',
                success: 'https://vrt.gredice.com/placanje?status=success',
            },
        },
    );

    assert.strictEqual(httpRequest.mock.callCount(), 1);
    assert.deepStrictEqual(result, {
        sessionId: 'cs_test',
        customerId: 'cus_test',
        url: 'https://checkout.stripe.com/test',
    });
});
