export type GeneratedPlantBatchDescription = {
    batchKey: string;
    signature: string;
};

/**
 * Preserves immutable batch objects when their render signature is unchanged.
 * Memoized batch renderers can then skip CPU rebuilds and GPU uploads for
 * raised beds that did not participate in an LOD transition.
 */
export function reconcileGeneratedPlantBatches<
    Batch extends GeneratedPlantBatchDescription,
>(
    previous: readonly Batch[] | undefined,
    next: readonly Batch[],
): readonly Batch[] {
    const seen = new Set<string>();
    for (const batch of next) {
        if (seen.has(batch.batchKey)) {
            throw new Error(
                `Duplicate generated-plant batch: ${batch.batchKey}`,
            );
        }
        seen.add(batch.batchKey);
    }

    if (!previous) {
        return next;
    }

    const previousByKey = new Map(
        previous.map((batch) => [batch.batchKey, batch]),
    );
    const reconciled = next.map((batch) => {
        const previousBatch = previousByKey.get(batch.batchKey);
        return previousBatch?.signature === batch.signature
            ? previousBatch
            : batch;
    });

    return previous.length === reconciled.length &&
        previous.every((batch, index) => batch === reconciled[index])
        ? previous
        : reconciled;
}
