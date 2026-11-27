import { useLayoutEffect, useReducer } from 'react';

/*
 * Resources every terrain rim in a scene shares: the garden rim's and the
 * HUD drag preview's (`TerrainRimInstances.tsx`). The preview mounts each
 * time the pointer comes back into the garden from the HUD, so it takes the
 * garden's built geometry, loaded soil and patched lips instead of building
 * its own.
 */

type SharedEntry<T> = { users: number; value: T };

/**
 * Keyed values built by their first user and held while any mounted user
 * holds them. The last release disposes a value one microtask later, so a
 * remount in the same commit (a keyed garden swap, React StrictMode running
 * effects twice) keeps it instead of disposing and rebuilding it.
 */
export function createSharedTerrainRimResources<T>(
    dispose: (value: T) => void,
) {
    const entries = new Map<string, SharedEntry<T>>();
    const entryOf = (key: string, create: () => T) => {
        let entry = entries.get(key);
        if (!entry) {
            entry = { users: 0, value: create() };
            entries.set(key, entry);
        }
        return entry;
    };
    return {
        /** The value for `key`, built on first use. Holds nothing. */
        peek(key: string, create: () => T) {
            return entryOf(key, create).value;
        },
        /** Holds the value for `key`; the release is idempotent. */
        hold(key: string, create: () => T) {
            const entry = entryOf(key, create);
            entry.users += 1;
            let released = false;
            return {
                value: entry.value,
                release: () => {
                    if (released) return;
                    released = true;
                    entry.users -= 1;
                    if (entry.users > 0) return;
                    queueMicrotask(() => {
                        if (entry.users > 0 || entries.get(key) !== entry) {
                            return;
                        }
                        entries.delete(key);
                        dispose(entry.value);
                    });
                },
            };
        },
        /** How many values are alive. */
        get size() {
            return entries.size;
        },
    };
}

export type SharedTerrainRimResources<T> = ReturnType<
    typeof createSharedTerrainRimResources<T>
>;

/** A shared value to use: its key, and how to build what the key names. */
export type SharedTerrainRimRequest<T> = { key: string; create: () => T };

/**
 * The shared value `request` names while the component is mounted, or
 * undefined without a request. Render reads it without holding it; the
 * hold is taken at commit.
 */
export function useSharedTerrainRimResource<T>(
    resources: SharedTerrainRimResources<T>,
    request: SharedTerrainRimRequest<T>,
): T;
export function useSharedTerrainRimResource<T>(
    resources: SharedTerrainRimResources<T>,
    request: SharedTerrainRimRequest<T> | null,
): T | undefined;
export function useSharedTerrainRimResource<T>(
    resources: SharedTerrainRimResources<T>,
    request: SharedTerrainRimRequest<T> | null,
) {
    const key = request?.key ?? null;
    const value = request
        ? resources.peek(request.key, request.create)
        : undefined;
    const [, rerender] = useReducer((count: number) => count + 1, 0);
    // biome-ignore lint/correctness/useExhaustiveDependencies: the key names what `create` builds, so a new request object for the same key changes nothing.
    useLayoutEffect(() => {
        if (!request) return;
        const lease = resources.hold(request.key, request.create);
        // Disposed between render and commit: draw the rebuilt value.
        if (lease.value !== value) rerender();
        return lease.release;
    }, [key, resources, value]);
    return value;
}
