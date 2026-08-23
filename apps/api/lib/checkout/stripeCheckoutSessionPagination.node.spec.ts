import assert from 'node:assert/strict';
import test from 'node:test';
import {
    collectStripePagesExhaustively,
    getStripeCheckoutSessionCreationRange,
} from '@gredice/stripe/server';

test('bounds a customer scan to the checkout creation window', () => {
    const createdAt = new Date('2026-08-03T20:00:00.000Z');
    assert.deepEqual(
        getStripeCheckoutSessionCreationRange({
            createdAt,
            expiresAt: new Date('2026-08-03T20:30:00.000Z'),
        }),
        {
            gte: Date.parse('2026-08-03T19:55:00.000Z') / 1000,
            lte: Date.parse('2026-08-03T20:35:00.000Z') / 1000,
        },
    );
    assert.deepEqual(
        getStripeCheckoutSessionCreationRange({
            createdAt,
            expiresAt: null,
        }),
        {
            gte: Date.parse('2026-08-03T19:55:00.000Z') / 1000,
            lte: Date.parse('2026-08-03T20:05:20.000Z') / 1000,
        },
    );
});

test('collects every Stripe page with a stable forward cursor', async () => {
    const cursors: Array<string | undefined> = [];
    const result = await collectStripePagesExhaustively({
        fetchPage: async (startingAfter) => {
            cursors.push(startingAfter);
            if (!startingAfter) {
                return {
                    data: [{ id: 'cs_2' }, { id: 'cs_1' }],
                    hasMore: true,
                };
            }
            return { data: [{ id: 'cs_0' }], hasMore: false };
        },
    });

    assert.deepEqual(cursors, [undefined, 'cs_1']);
    assert.deepEqual(result, {
        items: [{ id: 'cs_2' }, { id: 'cs_1' }, { id: 'cs_0' }],
        pageCount: 2,
        status: 'exhaustive',
    });
});

test('fails closed for invalid, truncated, and failed pagination', async () => {
    const emptyPage = await collectStripePagesExhaustively({
        fetchPage: async () => ({ data: [], hasMore: true }),
    });
    assert.deepEqual(emptyPage, {
        pageCount: 1,
        reason: 'invalid_pagination',
        status: 'partial',
    });

    const repeatedCursor = await collectStripePagesExhaustively({
        fetchPage: async () => ({ data: [{ id: 'cs_same' }], hasMore: true }),
    });
    assert.deepEqual(repeatedCursor, {
        pageCount: 2,
        reason: 'invalid_pagination',
        status: 'partial',
    });

    const pageLimit = await collectStripePagesExhaustively({
        fetchPage: async () => ({ data: [{ id: 'cs_more' }], hasMore: true }),
        maxPages: 1,
    });
    assert.deepEqual(pageLimit, {
        pageCount: 1,
        reason: 'page_limit',
        status: 'partial',
    });

    const requestFailure = await collectStripePagesExhaustively({
        fetchPage: async () => {
            throw new Error('Stripe unavailable');
        },
    });
    assert.deepEqual(requestFailure, {
        pageCount: 0,
        reason: 'request_failed',
        status: 'partial',
    });

    let now = 0;
    const timeLimit = await collectStripePagesExhaustively({
        fetchPage: async () => {
            now += 10;
            return { data: [{ id: `cs_${now.toString()}` }], hasMore: true };
        },
        maxDurationMs: 10,
        now: () => now,
    });
    assert.deepEqual(timeLimit, {
        pageCount: 1,
        reason: 'time_limit',
        status: 'partial',
    });
});
