import { useLayoutEffect, useMemo, useRef } from 'react';
import {
    type ChunkedMeshInstance,
    chunkMeshInstances,
    type MeshInstanceChunk,
} from './chunkedMeshGeometry';

export function useRetainedMeshChunks<T extends ChunkedMeshInstance>(
    instances: T[],
    equal: (left: T, right: T) => boolean = Object.is,
) {
    const previous = useRef<MeshInstanceChunk<T>[]>([]);
    const chunks = useMemo(
        () => chunkMeshInstances(instances, undefined, previous.current, equal),
        [instances, equal],
    );
    useLayoutEffect(() => {
        previous.current = chunks;
    }, [chunks]);
    return chunks;
}
