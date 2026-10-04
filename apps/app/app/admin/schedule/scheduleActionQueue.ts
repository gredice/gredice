import type { RaisedBedField } from './types';

export type ScheduleTaskVersionChange = {
    key: string;
    previous: number;
    current: number;
};

export function scheduleTaskVersionChange(
    key: string,
    previous: number,
    current: number,
) {
    return { scheduleTaskVersions: [{ key, previous, current }] };
}

export function fieldScheduleTaskVersionChange(
    field: Pick<RaisedBedField, 'id' | 'plantCycles'>,
    plantCycleEventId: number,
    previous: number,
) {
    // A terminal lifecycle update closes the cycle. Its committed version must
    // still be read from that exact cycle rather than only an active one.
    const cycle = field.plantCycles?.find(
        (item) => item.plantPlaceEventId === plantCycleEventId,
    );
    if (!cycle?.endedEventId) {
        throw new Error('Trenutna verzija sijanja nije ispravna.');
    }
    return scheduleTaskVersionChange(
        `field:${field.id}`,
        previous,
        cycle.endedEventId,
    );
}

export function resolveScheduleFormVersion(
    formData: FormData,
    key: string,
    field: string,
    getVersion: (key: string, expected: number) => number,
) {
    const next = new FormData();
    for (const [name, value] of formData) next.append(name, value);
    next.set(field, getVersion(key, Number(formData.get(field))).toString());
    return next;
}

class SettledScheduleActionsError extends Error {
    constructor(
        readonly results: unknown[],
        cause: unknown,
    ) {
        super('Promjena rasporeda nije uspjela. Pokušajte ponovno.', { cause });
    }
}

export async function settleScheduleActions(actions: Promise<unknown>[]) {
    const settled = await Promise.allSettled(actions);
    const results = settled.flatMap((result) =>
        result.status === 'fulfilled' ? [result.value] : [],
    );
    const rejection = settled.find((result) => result.status === 'rejected');
    if (rejection) {
        throw new SettledScheduleActionsError(results, rejection.reason);
    }
    return results;
}

export function createScheduleActionQueue() {
    const tails = new Map<string, Promise<void>>();
    const versions = new Map<string, Map<number, number>>();

    function getTaskVersion(key: string, expected: number): number {
        return versions.get(key)?.get(expected) ?? expected;
    }

    function rememberVersions(result: unknown) {
        if (Array.isArray(result)) {
            result.forEach(rememberVersions);
            return;
        }
        if (
            typeof result !== 'object' ||
            result === null ||
            !('scheduleTaskVersions' in result) ||
            !Array.isArray(result.scheduleTaskVersions)
        )
            return;

        for (const change of result.scheduleTaskVersions) {
            if (
                typeof change !== 'object' ||
                change === null ||
                !('key' in change) ||
                typeof change.key !== 'string' ||
                !('previous' in change) ||
                typeof change.previous !== 'number' ||
                !('current' in change) ||
                typeof change.current !== 'number'
            )
                continue;
            const lineage =
                versions.get(change.key) ?? new Map<number, number>();
            // Advance only versions produced by this queue. External edits still
            // fail the server's expected-version checks.
            for (const [previous, current] of lineage) {
                if (current === change.previous)
                    lineage.set(previous, change.current);
            }
            lineage.set(change.previous, change.current);
            versions.set(change.key, lineage);
        }
    }

    function run<T>(
        keys: string[],
        action: (getVersion: typeof getTaskVersion) => Promise<T>,
    ) {
        const targets = [...new Set(keys)];
        const predecessors = targets.flatMap((key) => {
            const tail = tails.get(key);
            return tail ? [tail] : [];
        });
        const result = Promise.all(predecessors).then(async () => {
            try {
                const value = await action(getTaskVersion);
                rememberVersions(value);
                return value;
            } catch (error) {
                if (error instanceof SettledScheduleActionsError) {
                    // Keep successful bulk mutations while preserving the
                    // caller's existing error alert and rollback behavior.
                    rememberVersions(error.results);
                    throw error.cause;
                }
                throw error;
            }
        });
        // Rejections release every target without poisoning its next request.
        const settled = result.then(
            () => undefined,
            () => undefined,
        );
        for (const key of targets) tails.set(key, settled);
        void settled.then(() => {
            for (const key of targets) {
                if (tails.get(key) === settled) tails.delete(key);
            }
        });
        return result;
    }

    return { run };
}
