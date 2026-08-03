import assert from 'node:assert/strict';
import test from 'node:test';
import { collectStripePagesExhaustively } from '@gredice/stripe/server';

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
});
