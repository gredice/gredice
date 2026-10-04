import {
    getGardenPreviewBlobScanCursor,
    listGardenPreviewPathnames,
    setGardenPreviewBlobScanCursor,
} from '@gredice/storage';
import { del, list } from '@vercel/blob';
import type { NextRequest } from 'next/server';
import {
    getNextGardenPreviewBlobScanCursor,
    selectOrphanedGardenPreviewBlobUrls,
} from '../../../../../lib/garden/gardenPreviewBlobCleanup';

export const dynamic = 'force-dynamic';

const GARDEN_PREVIEW_BLOB_PREFIX = 'garden-previews/';
const ORPHAN_MIN_AGE_MS = 24 * 60 * 60 * 1000;
const LIST_PAGE_SIZE = 500;
const MAX_SCANNED_BLOBS = 5_000;
const MAX_DURATION_MS = 40_000;
const DELETE_BATCH_SIZE = 100;

function batches<T>(items: T[], batchSize: number) {
    const result: T[][] = [];
    for (let index = 0; index < items.length; index += batchSize) {
        result.push(items.slice(index, index + batchSize));
    }
    return result;
}

export async function GET(request: NextRequest) {
    const cronSecret = process.env.CRON_SECRET?.trim();
    if (
        !cronSecret ||
        request.headers.get('authorization') !== `Bearer ${cronSecret}`
    ) {
        return new Response('Unauthorized', { status: 401 });
    }

    const startedAt = Date.now();
    const orphanCutoff = startedAt - ORPHAN_MIN_AGE_MS;
    const [referencedPathnameList, savedCursor] = await Promise.all([
        listGardenPreviewPathnames(),
        getGardenPreviewBlobScanCursor(),
    ]);
    const referencedPathnames = new Set(referencedPathnameList);
    const orphanUrls: string[] = [];
    let scanned = 0;
    let cursor = savedCursor ?? undefined;
    let hasMore = false;

    do {
        let page: Awaited<ReturnType<typeof list>>;
        try {
            page = await list({
                prefix: GARDEN_PREVIEW_BLOB_PREFIX,
                limit: Math.min(LIST_PAGE_SIZE, MAX_SCANNED_BLOBS - scanned),
                ...(cursor ? { cursor } : {}),
            });
        } catch (error) {
            if (cursor) {
                await setGardenPreviewBlobScanCursor(null);
                console.error('Reset invalid garden preview Blob scan cursor', {
                    cursor,
                    error,
                });
            }
            throw error;
        }

        scanned += page.blobs.length;
        orphanUrls.push(
            ...selectOrphanedGardenPreviewBlobUrls({
                blobs: page.blobs,
                orphanCutoff,
                referencedPathnames,
            }),
        );
        const nextCursor = getNextGardenPreviewBlobScanCursor({
            cursor: page.cursor,
            hasMore: page.hasMore,
        });
        await setGardenPreviewBlobScanCursor(nextCursor);
        cursor = nextCursor ?? undefined;
        hasMore = nextCursor !== null;
    } while (
        hasMore &&
        cursor &&
        scanned < MAX_SCANNED_BLOBS &&
        Date.now() - startedAt < MAX_DURATION_MS
    );

    let deleted = 0;
    let failed = 0;
    for (const batch of batches(orphanUrls, DELETE_BATCH_SIZE)) {
        if (Date.now() - startedAt >= MAX_DURATION_MS) {
            break;
        }

        try {
            await del(batch);
            deleted += batch.length;
        } catch (error) {
            failed += batch.length;
            console.error('Failed to delete orphaned garden preview blobs', {
                batchSize: batch.length,
                error,
            });
        }
    }

    const durationMs = Date.now() - startedAt;
    return Response.json(
        {
            success: failed === 0,
            scanned,
            startedFromSavedCursor: savedCursor !== null,
            referenced: referencedPathnames.size,
            orphaned: orphanUrls.length,
            deleted,
            failed,
            hasMore,
            stoppedForTimeBudget: durationMs >= MAX_DURATION_MS,
            durationMs,
            timestamp: new Date().toISOString(),
        },
        { status: failed === 0 ? 200 : 500 },
    );
}
