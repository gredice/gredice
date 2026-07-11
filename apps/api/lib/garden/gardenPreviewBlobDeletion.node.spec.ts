import assert from 'node:assert/strict';
import test from 'node:test';
import {
    getGardenPreviewBlobDeletionRetryAt,
    processGardenPreviewBlobDeletions,
} from './gardenPreviewBlobDeletion';

test('processGardenPreviewBlobDeletions records successes and retryable failures', async () => {
    const result = await processGardenPreviewBlobDeletions({
        concurrency: 2,
        deleteBlob: async (imageUrl) => {
            if (imageUrl.endsWith('/failed.webp')) {
                throw new Error('Blob service unavailable');
            }
        },
        deletions: [
            { id: 2, imageUrl: 'https://blob.test/failed.webp' },
            { id: 1, imageUrl: 'https://blob.test/deleted.webp' },
        ],
    });

    assert.deepEqual(result, {
        completedIds: [1],
        failures: [
            {
                error: 'Error: Blob service unavailable',
                id: 2,
            },
        ],
    });
});

test('getGardenPreviewBlobDeletionRetryAt backs off and caps retries', () => {
    const now = new Date('2026-07-11T12:00:00.000Z');

    assert.equal(
        getGardenPreviewBlobDeletionRetryAt({ attempts: 0, now }).toISOString(),
        '2026-07-11T12:01:00.000Z',
    );
    assert.equal(
        getGardenPreviewBlobDeletionRetryAt({
            attempts: 100,
            now,
        }).toISOString(),
        '2026-07-11T18:00:00.000Z',
    );
});
