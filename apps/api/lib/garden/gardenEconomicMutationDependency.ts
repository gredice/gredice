export const gardenEconomicMutationDependencyTimeoutMs = 2_000;

export class GardenEconomicMutationDependencyTimeoutError extends Error {
    override readonly name = 'GardenEconomicMutationDependencyTimeoutError';

    constructor() {
        super('Garden economic mutation dependency preparation timed out');
    }
}

function normalizedTimeout(timeoutMs: number | undefined) {
    return Number.isSafeInteger(timeoutMs) && (timeoutMs ?? 0) > 0
        ? (timeoutMs ?? gardenEconomicMutationDependencyTimeoutMs)
        : gardenEconomicMutationDependencyTimeoutMs;
}

/**
 * Prepares a read-only dependency before economic locks without allowing a
 * stalled catalogue read to prevent durable receipt replay indefinitely.
 */
export async function settleGardenEconomicMutationDependency<Value>(
    load: () => Promise<Value>,
    timeoutMs?: number,
): Promise<PromiseSettledResult<Value>> {
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_resolve, reject) => {
        timeoutHandle = setTimeout(
            () => reject(new GardenEconomicMutationDependencyTimeoutError()),
            normalizedTimeout(timeoutMs),
        );
    });

    try {
        const value = await Promise.race([
            Promise.resolve().then(load),
            timeout,
        ]);
        return { status: 'fulfilled', value };
    } catch (reason) {
        return { status: 'rejected', reason };
    } finally {
        if (timeoutHandle !== undefined) {
            clearTimeout(timeoutHandle);
        }
    }
}
