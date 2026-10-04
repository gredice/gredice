export async function runTasksWithConcurrency<Item, Result>(
    items: readonly Item[],
    concurrency: number,
    task: (item: Item, index: number) => Promise<Result>,
) {
    if (items.length === 0) {
        return [];
    }

    const requestedConcurrency = Number.isFinite(concurrency)
        ? Math.floor(concurrency)
        : 1;
    const workerCount = Math.min(
        items.length,
        Math.max(1, requestedConcurrency),
    );
    const entries = items.entries();

    async function worker() {
        const results: Array<{ index: number; result: Result }> = [];

        for (const [index, item] of entries) {
            results.push({ index, result: await task(item, index) });
        }

        return results;
    }

    const resultsByWorker = await Promise.all(
        Array.from({ length: workerCount }, () => worker()),
    );

    return resultsByWorker
        .flat()
        .sort((left, right) => left.index - right.index)
        .map(({ result }) => result);
}
