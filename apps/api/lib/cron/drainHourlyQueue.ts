/** Drain up to the former twelve five-minute batches in one bounded hourly window. */
export async function drainHourlyQueue<T>({
    runBatch,
    shouldContinue,
    now = Date.now,
}: {
    runBatch: () => Promise<T>;
    shouldContinue: (result: T) => boolean;
    now?: () => number;
}) {
    const startedAt = now();
    const results: T[] = [];
    for (let batch = 0; batch < 12; batch += 1) {
        if (now() - startedAt >= 240_000) {
            return { capacityReached: true, results };
        }
        const result = await runBatch();
        results.push(result);
        if (!shouldContinue(result)) {
            return { capacityReached: false, results };
        }
    }
    return { capacityReached: true, results };
}
