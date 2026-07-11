export type GardenPreviewBlobDeletionCandidate = {
    id: number;
    imageUrl: string;
};

export type GardenPreviewBlobDeletionFailure = {
    error: string;
    id: number;
};

const defaultConcurrency = 8;
const maximumErrorLength = 2_000;
const retryBaseDelayMs = 60_000;
const retryMaximumDelayMs = 6 * 60 * 60 * 1_000;

function formatDeletionError(error: unknown) {
    const message =
        error instanceof Error
            ? `${error.name}: ${error.message}`
            : String(error);
    return message.slice(0, maximumErrorLength);
}

export function getGardenPreviewBlobDeletionRetryAt({
    attempts,
    now,
}: {
    attempts: number;
    now: Date;
}) {
    const exponent = Math.min(16, Math.max(0, Math.floor(attempts)));
    const delayMs = Math.min(
        retryMaximumDelayMs,
        retryBaseDelayMs * 2 ** exponent,
    );
    return new Date(now.getTime() + delayMs);
}

export async function processGardenPreviewBlobDeletions<
    T extends GardenPreviewBlobDeletionCandidate,
>({
    concurrency = defaultConcurrency,
    deleteBlob,
    deletions,
}: {
    concurrency?: number;
    deleteBlob: (imageUrl: string) => Promise<void>;
    deletions: readonly T[];
}) {
    const completedIds: number[] = [];
    const failures: GardenPreviewBlobDeletionFailure[] = [];
    let nextIndex = 0;

    async function worker() {
        while (nextIndex < deletions.length) {
            const index = nextIndex;
            nextIndex += 1;
            const deletion = deletions[index];
            if (!deletion) {
                return;
            }

            try {
                await deleteBlob(deletion.imageUrl);
                completedIds.push(deletion.id);
            } catch (error) {
                failures.push({
                    error: formatDeletionError(error),
                    id: deletion.id,
                });
            }
        }
    }

    const workerCount = Math.min(
        deletions.length,
        Math.max(1, Math.floor(concurrency)),
    );
    await Promise.all(Array.from({ length: workerCount }, () => worker()));

    completedIds.sort((left, right) => left - right);
    failures.sort((left, right) => left.id - right.id);
    return { completedIds, failures };
}
