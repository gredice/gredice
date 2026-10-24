import { type PropsWithChildren, Suspense } from 'react';
import type { Stack } from '../types/Stack';
import {
    hasIndexedEntityBlocks,
    useEntityBlockInstanceIndex,
} from './entityBlockInstanceIndex';

/**
 * Mounts a renderer family only when one of its blocks is in the scene, so
 * absent families never fetch or decode their GLBs. Each family gets its own
 * Suspense boundary and appears as soon as its own assets are ready.
 */
export function EntityBlockPresenceGate({
    children,
    names,
    stacks,
}: PropsWithChildren<{
    names: readonly string[];
    stacks: Stack[] | undefined;
}>) {
    const instanceIndex = useEntityBlockInstanceIndex(stacks);
    if (!names.some((name) => hasIndexedEntityBlocks(instanceIndex, name))) {
        return null;
    }

    return <Suspense fallback={null}>{children}</Suspense>;
}
