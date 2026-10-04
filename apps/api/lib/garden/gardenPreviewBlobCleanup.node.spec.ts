import assert from 'node:assert/strict';
import test from 'node:test';
import {
    getNextGardenPreviewBlobScanCursor,
    selectOrphanedGardenPreviewBlobUrls,
} from './gardenPreviewBlobCleanup';

test('getNextGardenPreviewBlobScanCursor persists progress and rotates at the end', () => {
    assert.equal(
        getNextGardenPreviewBlobScanCursor({
            cursor: 'next-page',
            hasMore: true,
        }),
        'next-page',
    );
    assert.equal(
        getNextGardenPreviewBlobScanCursor({
            cursor: 'last-page',
            hasMore: false,
        }),
        null,
    );
    assert.equal(getNextGardenPreviewBlobScanCursor({ hasMore: true }), null);
});

test('selectOrphanedGardenPreviewBlobUrls keeps referenced and recent blobs', () => {
    const now = Date.parse('2026-07-12T12:00:00.000Z');
    const referencedPathname = 'garden-previews/1/referenced.webp';

    assert.deepEqual(
        selectOrphanedGardenPreviewBlobUrls({
            blobs: [
                {
                    pathname: referencedPathname,
                    uploadedAt: new Date(now - 48 * 60 * 60 * 1000),
                    url: 'https://blob.test/referenced.webp',
                },
                {
                    pathname: 'garden-previews/1/recent.webp',
                    uploadedAt: new Date(now - 60 * 60 * 1000),
                    url: 'https://blob.test/recent.webp',
                },
                {
                    pathname: 'garden-previews/1/orphaned.webp',
                    uploadedAt: new Date(now - 48 * 60 * 60 * 1000),
                    url: 'https://blob.test/orphaned.webp',
                },
            ],
            orphanCutoff: now - 24 * 60 * 60 * 1000,
            referencedPathnames: new Set([referencedPathname]),
        }),
        ['https://blob.test/orphaned.webp'],
    );
});
