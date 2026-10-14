const queues = new Map<string, Promise<void>>();
/** Serialize cache read/placement/write across paid and prepaid placement hooks. */
export async function withGardenOptimisticMutationLock<T>(
    key: string,
    task: () => Promise<T>,
): Promise<T> {
    const previous = queues.get(key) ?? Promise.resolve();
    const current = previous.catch(() => undefined).then(task);
    const tail = current.then(
        () => undefined,
        () => undefined,
    );
    queues.set(key, tail);
    try {
        return await current;
    } finally {
        if (queues.get(key) === tail) queues.delete(key);
    }
}
