import assert from 'node:assert/strict';
import test from 'node:test';
import {
    getGardenPreviewBlobDeletionRetryAt,
    processGardenPreviewBlobDeletions,
    redactGardenPreviewBlobDeletionError,
} from './gardenPreviewBlobDeletion';

test('processGardenPreviewBlobDeletions records successes and retryable failures', async () => {
    const deletionTargets: string[] = [];
    const result = await processGardenPreviewBlobDeletions({
        concurrency: 2,
        deleteBlob: async (pathname) => {
            deletionTargets.push(pathname);
            if (pathname.endsWith('/failed.webp')) {
                throw new Error('Blob service unavailable');
            }
        },
        deletions: [
            {
                id: 2,
                imageUrl: 'https://example.test/failed.webp',
                pathname: 'garden-previews/2/failed.webp',
            },
            {
                id: 1,
                imageUrl: 'https://example.test/deleted.webp',
                pathname: 'garden-previews/1/deleted.webp',
            },
        ],
    });

    assert.deepEqual(deletionTargets.sort(), [
        'garden-previews/1/deleted.webp',
        'garden-previews/2/failed.webp',
    ]);
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

test('redactGardenPreviewBlobDeletionError removes Blob URLs from logs', () => {
    assert.equal(
        redactGardenPreviewBlobDeletionError(
            'Error: failed to delete https://private-store.public.blob.vercel-storage.com/garden-previews/1/day.webp',
        ),
        'Error: failed to delete [redacted-url]',
    );
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
