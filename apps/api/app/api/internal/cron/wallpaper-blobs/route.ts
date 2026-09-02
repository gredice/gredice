import { del, list } from '@vercel/blob';
import type { NextRequest } from 'next/server';
import { expiredMacOSDynamicWallpaperBlobPathnames } from '../../../../../lib/wallpapers/macOSDynamicWallpaperBlobCleanup';
import { macOSDynamicWallpaperBlobPrefix } from '../../../../../lib/wallpapers/macOSDynamicWallpaperBlobs';

export const dynamic = 'force-dynamic';

const expirationMs = 2 * 60 * 60 * 1_000;
const listPageSize = 500;
const maximumScannedBlobs = 5_000;
const maximumDurationMs = 40_000;
const deleteBatchSize = 100;

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
    const cutoff = new Date(startedAt - expirationMs);
    const expiredPathnames: string[] = [];
    let scanned = 0;
    let cursor: string | undefined;
    let hasMore = false;

    do {
        const page = await list({
            prefix: macOSDynamicWallpaperBlobPrefix,
            limit: Math.min(listPageSize, maximumScannedBlobs - scanned),
            ...(cursor ? { cursor } : {}),
        });
        scanned += page.blobs.length;
        expiredPathnames.push(
            ...expiredMacOSDynamicWallpaperBlobPathnames({
                blobs: page.blobs,
                cutoff,
            }),
        );
        cursor = page.hasMore ? page.cursor : undefined;
        hasMore = Boolean(cursor);
    } while (
        hasMore &&
        cursor &&
        scanned < maximumScannedBlobs &&
        Date.now() - startedAt < maximumDurationMs
    );

    let deleted = 0;
    let failed = 0;
    for (const batch of batches(expiredPathnames, deleteBatchSize)) {
        if (Date.now() - startedAt >= maximumDurationMs) {
            break;
        }
        try {
            await del(batch);
            deleted += batch.length;
        } catch (error) {
            failed += batch.length;
            console.error('Failed to delete expired wallpaper blobs', {
                batchSize: batch.length,
                error,
            });
        }
    }

    const durationMs = Date.now() - startedAt;
    return Response.json(
        {
            deleted,
            durationMs,
            expired: expiredPathnames.length,
            failed,
            hasMore,
            scanned,
            stoppedForTimeBudget: durationMs >= maximumDurationMs,
            success: failed === 0,
            timestamp: new Date().toISOString(),
        },
        { status: failed === 0 ? 200 : 500 },
    );
}
