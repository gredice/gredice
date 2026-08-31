type PostHogLogFlushSchedulerOptions = {
    batchDelayMs: number;
    failureCooldownMs: number;
    flush: () => Promise<void>;
    now?: () => number;
    onError: (error: unknown) => void;
    wait?: (delayMs: number) => Promise<void>;
};

function waitFor(delayMs: number): Promise<void> {
    return new Promise((resolve) => {
        setTimeout(resolve, delayMs);
    });
}

export function createPostHogLogFlushScheduler({
    batchDelayMs,
    failureCooldownMs,
    flush,
    now = Date.now,
    onError,
    wait = waitFor,
}: PostHogLogFlushSchedulerOptions): () => Promise<void> {
    let pendingFlush: Promise<void> | null = null;
    let retryAfter = 0;

    return function schedulePostHogLogFlush(): Promise<void> {
        if (pendingFlush) {
            return pendingFlush;
        }

        if (now() < retryAfter) {
            return Promise.resolve();
        }

        pendingFlush = wait(batchDelayMs)
            .then(flush)
            .catch((error) => {
                retryAfter = now() + failureCooldownMs;
                onError(error);
            })
            .finally(() => {
                pendingFlush = null;
            });

        return pendingFlush;
    };
}
