import assert from 'node:assert/strict';
import test from 'node:test';
import { Hono } from 'hono';
import {
    CheckoutTiming,
    type CheckoutTimingVariables,
    checkoutItemCountBucket,
    checkoutOutcomeFromStatus,
    checkoutTimingMiddleware,
} from './checkoutTiming';

test('checkout timing records monotonic phase and total durations', async () => {
    let currentTime = 100;
    const records: Array<{
        attributes: Record<string, unknown>;
        event: string;
        level: string;
    }> = [];
    const timing = new CheckoutTiming({
        now: () => currentTime,
        write: (level, event, attributes) => {
            records.push({ attributes, event, level });
        },
    });

    timing.setContext({ itemCount: 5, paymentKind: 'sunflower' });
    await timing.measure('account_cart_load', async () => {
        currentTime += 12.34;
    });
    const endFulfillment = timing.startPhase('non_stripe_fulfillment');
    currentTime += 8.01;
    endFulfillment();
    currentTime += 1.05;

    assert.equal(timing.finish({ status: 200 }), true);
    assert.deepEqual(records, [
        {
            attributes: {
                accountCartLoadDurationMs: 12.3,
                itemCountBucket: '4-10',
                nonStripeFulfillmentDurationMs: 8,
                outcome: 'success',
                paymentKind: 'sunflower',
                route: '/api/checkout/checkout',
                statusCode: 200,
                totalDurationMs: 21.4,
            },
            event: 'checkout.request.complete',
            level: 'info',
        },
    ]);
});

test('checkout timing emits one privacy-safe unexpected failure record', () => {
    let currentTime = 20;
    const records: Array<Record<string, unknown>> = [];
    const timing = new CheckoutTiming({
        now: () => currentTime,
        write: (level, event, attributes) => {
            records.push({ level, event, ...attributes });
        },
    });

    timing.setErrorCategory('unexpected');
    currentTime = 10;

    assert.equal(
        timing.finish({ outcome: 'unexpected_failure', status: 500 }),
        true,
    );
    assert.equal(timing.finish({ status: 200 }), false);
    assert.deepEqual(records, [
        {
            errorCategory: 'unexpected',
            event: 'checkout.request.complete',
            itemCountBucket: 'unknown',
            level: 'error',
            outcome: 'unexpected_failure',
            paymentKind: 'unknown',
            route: '/api/checkout/checkout',
            statusCode: 500,
            totalDurationMs: 0,
        },
    ]);
});

test('checkout timing accumulates repeated phases and ends each phase once', () => {
    let currentTime = 0;
    let record: Record<string, unknown> | undefined;
    const timing = new CheckoutTiming({
        now: () => currentTime,
        write: (_level, _event, attributes) => {
            record = attributes;
        },
    });

    const endFirst = timing.startPhase('analytics');
    currentTime = 2;
    endFirst();
    endFirst();
    const endSecond = timing.startPhase('analytics');
    currentTime = 5;
    endSecond();
    timing.finish({ status: 204 });

    assert.equal(record?.analyticsDurationMs, 5);
});

test('checkout item count and response status use bounded categories', () => {
    assert.deepEqual([-1, 1, 2, 4, 11].map(checkoutItemCountBucket), [
        '0',
        '1',
        '2-3',
        '4-10',
        '11+',
    ]);
    assert.equal(checkoutOutcomeFromStatus(200), 'success');
    assert.equal(checkoutOutcomeFromStatus(409), 'rejected');
    assert.equal(checkoutOutcomeFromStatus(503), 'failed');
});

test('checkout timing middleware emits one record for every response path', async () => {
    let currentTime = 0;
    const records: Array<Record<string, unknown>> = [];
    const app = new Hono<{ Variables: CheckoutTimingVariables }>();
    app.use(
        checkoutTimingMiddleware({
            now: () => currentTime,
            write: (level, event, attributes) => {
                records.push({ level, event, ...attributes });
            },
        }),
    );
    app.get('/auth-rejection', (context) => context.json({}, 401));
    app.get('/schema-rejection', (context) => context.json({}, 400));
    app.get('/success', (context) => context.json({ ok: true }));
    app.get('/unexpected', () => {
        throw new Error('private failure details');
    });
    app.onError((_error, context) => context.json({}, 500));

    for (const path of [
        '/auth-rejection',
        '/schema-rejection',
        '/success',
        '/unexpected',
    ]) {
        currentTime += 5;
        await app.request(path);
    }

    assert.equal(records.length, 4);
    assert.deepEqual(
        records.map(({ errorCategory, outcome, statusCode }) => ({
            errorCategory,
            outcome,
            statusCode,
        })),
        [
            {
                errorCategory: undefined,
                outcome: 'rejected',
                statusCode: 401,
            },
            {
                errorCategory: undefined,
                outcome: 'rejected',
                statusCode: 400,
            },
            {
                errorCategory: undefined,
                outcome: 'success',
                statusCode: 200,
            },
            {
                errorCategory: 'unexpected',
                outcome: 'unexpected_failure',
                statusCode: 500,
            },
        ],
    );
    assert.equal(
        JSON.stringify(records).includes('private failure details'),
        false,
    );
});
