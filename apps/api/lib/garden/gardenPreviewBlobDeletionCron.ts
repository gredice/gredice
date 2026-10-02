import {
    claimGardenPreviewBlobDeletions,
    completeGardenPreviewBlobDeletions,
    recordGardenPreviewBlobDeletionFailures,
} from '@gredice/storage';
import { del } from '@vercel/blob';
import {
    getGardenPreviewBlobDeletionRetryAt,
    processGardenPreviewBlobDeletions,
    redactGardenPreviewBlobDeletionError,
} from './gardenPreviewBlobDeletion';

const CLAIM_DURATION_MS = 60_000;
const DELETE_BATCH_SIZE = 100;
const DELETE_CONCURRENCY = 8;
const MAXIMUM_BATCHES = 10;
const WORK_WINDOW_MS = 45_000;
const noStoreHeaders = { 'Cache-Control': 'private, no-store' };

type Dependencies = {
    claim: typeof claimGardenPreviewBlobDeletions;
    complete: typeof completeGardenPreviewBlobDeletions;
    fail: typeof recordGardenPreviewBlobDeletionFailures;
    deleteBlob: (pathname: string) => Promise<void>;
    now: () => Date;
};
const defaultDependencies: Dependencies = {
    claim: claimGardenPreviewBlobDeletions,
    complete: completeGardenPreviewBlobDeletions,
    fail: recordGardenPreviewBlobDeletionFailures,
    deleteBlob: async (pathname) => del(pathname),
    now: () => new Date(),
};

export async function handleGardenPreviewBlobDeletionCron(
    request: Request,
    overrides: Partial<Dependencies> = {},
) {
    const cronSecret = process.env.CRON_SECRET?.trim();
    if (
        !cronSecret ||
        request.headers.get('authorization') !== `Bearer ${cronSecret}`
    ) {
        return new Response('Unauthorized', {
            headers: noStoreHeaders,
            status: 401,
        });
    }

    const dependencies = { ...defaultDependencies, ...overrides };
    const startedAt = dependencies.now();
    const claimId = globalThis.crypto.randomUUID();

    let batches = 0;
    let claimed = 0;
    let deleted = 0;
    let failureCount = 0;
    let capacityReached = false;
    try {
        while (batches < MAXIMUM_BATCHES) {
            const batchStartedAt = dependencies.now();
            if (
                batchStartedAt.getTime() - startedAt.getTime() >=
                WORK_WINDOW_MS
            ) {
                capacityReached = true;
                break;
            }
            const deletions = await dependencies.claim({
                claimId,
                expiresAt: new Date(
                    batchStartedAt.getTime() + CLAIM_DURATION_MS,
                ),
                limit: DELETE_BATCH_SIZE,
                now: batchStartedAt,
            });
            if (deletions.length === 0) break;
            batches += 1;
            claimed += deletions.length;
            const result = await processGardenPreviewBlobDeletions({
                concurrency: DELETE_CONCURRENCY,
                deleteBlob: dependencies.deleteBlob,
                deletions,
            });

            const completed = await dependencies.complete({
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
                    now: batchStartedAt,
                }),
            }));
            const failed = await dependencies.fail({
                attemptedAt: batchStartedAt,
                claimId,
                failures,
            });

            if (failures.length > 0) {
                console.warn('Garden preview Blob deletions will be retried', {
                    claimId,
                    failures: failures.map((failure) => ({
                        attempts:
                            (deletionById.get(failure.id)?.attempts ?? 0) + 1,
                        error: redactGardenPreviewBlobDeletionError(
                            failure.error,
                        ),
                        id: failure.id,
                    })),
                });
            }

            if (
                completed !== result.completedIds.length ||
                failed !== failures.length
            ) {
                throw new Error(
                    'Garden preview Blob deletion outbox state changed while processing',
                );
            }

            deleted += completed;
            failureCount += failed;
            // Failed rows now have a future retry time and cannot be reclaimed here.
            if (deletions.length < DELETE_BATCH_SIZE) break;
            capacityReached = batches === MAXIMUM_BATCHES;
        }
        if (capacityReached) {
            console.warn(
                'Garden preview Blob deletion daily capacity reached',
                {
                    batches,
                    claimed,
                    deleted,
                    failed: failureCount,
                },
            );
        }
        return Response.json(
            {
                success: failureCount === 0 && !capacityReached,
                batches,
                capacityReached,
                claimed,
                deleted,
                failed: failureCount,
                durationMs: dependencies.now().getTime() - startedAt.getTime(),
                timestamp: dependencies.now().toISOString(),
            },
            {
                headers: noStoreHeaders,
                status: failureCount === 0 && !capacityReached ? 200 : 503,
            },
        );
    } catch (error) {
        console.error('Failed to process garden preview Blob deletions', {
            claimId,
            error,
        });
        return Response.json(
            {
                success: false,
                error: 'Garden preview Blob deletion failed',
                durationMs: dependencies.now().getTime() - startedAt.getTime(),
                timestamp: dependencies.now().toISOString(),
            },
            { headers: noStoreHeaders, status: 500 },
        );
    }
}
