export type PackedPlantWorkerExecutionKind = 'sync-fallback' | 'worker';

export interface PackedPlantWorkerExecutionResult<Response> {
    executionKind: PackedPlantWorkerExecutionKind;
    response: Response;
}

export interface ProfiledPackedPlantWorkerExecutionResult<Response>
    extends PackedPlantWorkerExecutionResult<Response> {
    workerDurationMs: number | null;
}

interface PackedPlantWorkerAttemptOptions {
    allowSyncFallback: boolean;
    onWorkerAttemptStarted: () => void;
}

interface RunPackedPlantWorkerWithRetryOptions<Response> {
    execute: (
        options: PackedPlantWorkerAttemptOptions,
    ) => Promise<PackedPlantWorkerExecutionResult<Response>>;
    isRuntimeError: (error: unknown) => boolean;
    now?: () => number;
    onWorkerAttemptFailed?: (durationMs: number) => void;
    onWorkerAttemptStarted?: () => void;
}

/**
 * Retries one runtime worker failure while keeping profiling aligned to actual
 * attempted worker requests. A synchronous fallback never emits
 * worker-attempt callbacks or a worker duration.
 */
export async function runPackedPlantWorkerWithRetry<Response>({
    execute,
    isRuntimeError,
    now = () => performance.now(),
    onWorkerAttemptFailed,
    onWorkerAttemptStarted,
}: RunPackedPlantWorkerWithRetryOptions<Response>) {
    const observeWorkerAttempts =
        onWorkerAttemptFailed !== undefined ||
        onWorkerAttemptStarted !== undefined;
    const runAttempt = async (allowSyncFallback: boolean) => {
        let workerStartedAt: number | null = null;

        try {
            const result = await execute({
                allowSyncFallback,
                onWorkerAttemptStarted: () => {
                    if (observeWorkerAttempts) {
                        workerStartedAt = now();
                    }
                    onWorkerAttemptStarted?.();
                },
            });
            return {
                ...result,
                workerDurationMs:
                    result.executionKind === 'worker' &&
                    workerStartedAt !== null
                        ? Math.max(0, now() - workerStartedAt)
                        : null,
            } satisfies ProfiledPackedPlantWorkerExecutionResult<Response>;
        } catch (error) {
            if (
                workerStartedAt !== null &&
                onWorkerAttemptFailed !== undefined
            ) {
                onWorkerAttemptFailed(Math.max(0, now() - workerStartedAt));
            }
            throw error;
        }
    };

    try {
        return await runAttempt(true);
    } catch (error) {
        if (!isRuntimeError(error)) {
            throw error;
        }

        return runAttempt(false);
    }
}
