import {
    claimGardenPreviewBlobDeletions,
    completeGardenPreviewBlobDeletions,
    recordGardenPreviewBlobDeletionFailures,
} from '@gredice/storage';
import { del } from '@vercel/blob';
import type { NextRequest } from 'next/server';
import {
    getGardenPreviewBlobDeletionRetryAt,
    processGardenPreviewBlobDeletions,
} from '../../../../../lib/garden/gardenPreviewBlobDeletion';

export const dynamic = 'force-dynamic';

const CLAIM_DURATION_MS = 60_000;
const DELETE_BATCH_SIZE = 100;
const DELETE_CONCURRENCY = 8;

export async function GET(request: NextRequest) {
    const cronSecret = process.env.CRON_SECRET?.trim();
    if (
        !cronSecret ||
        request.headers.get('authorization') !== `Bearer ${cronSecret}`
    ) {
        return new Response('Unauthorized', { status: 401 });
    }

    const startedAt = new Date();
    const claimId = globalThis.crypto.randomUUID();

    try {
        const deletions = await claimGardenPreviewBlobDeletions({
            claimId,
            expiresAt: new Date(startedAt.getTime() + CLAIM_DURATION_MS),
            limit: DELETE_BATCH_SIZE,
            now: startedAt,
        });
        const result = await processGardenPreviewBlobDeletions({
            concurrency: DELETE_CONCURRENCY,
            deleteBlob: async (imageUrl) => del(imageUrl),
            deletions,
        });

        const completed = await completeGardenPreviewBlobDeletions({
            claimId,
            ids: result.completedIds,
        });
        const deletionById = new Map(
            deletions.map((deletion) => [deletion.id, deletion]),
        );
        const failures = result.failures.map((failure) => ({
            ...failure,
            retryAt: getGardenPreviewBlobDeletionRetryAt({
                attempts: deletionById.get(failure.id)?.attempts ?? 0,
                now: startedAt,
            }),
        }));
        const failed = await recordGardenPreviewBlobDeletionFailures({
            attemptedAt: startedAt,
            claimId,
            failures,
        });

        if (
            completed !== result.completedIds.length ||
            failed !== failures.length
        ) {
            throw new Error(
                'Garden preview Blob deletion outbox state changed while processing',
            );
        }

        return Response.json(
            {
                success: failures.length === 0,
                claimed: deletions.length,
                deleted: completed,
                failed,
                durationMs: Date.now() - startedAt.getTime(),
                timestamp: new Date().toISOString(),
            },
            { status: failures.length === 0 ? 200 : 500 },
        );
    } catch (error) {
        console.error('Failed to process garden preview Blob deletions', {
            claimId,
            error,
        });
        return Response.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                durationMs: Date.now() - startedAt.getTime(),
                timestamp: new Date().toISOString(),
            },
            { status: 500 },
        );
    }
}
