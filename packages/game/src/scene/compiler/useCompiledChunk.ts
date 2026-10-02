import { useLayoutEffect, useMemo, useState } from 'react';
import type { BufferGeometry } from 'three';
import {
    type ChunkedMeshInstance,
    createChunkMatrices,
    type MeshInstanceLocalTransform,
    type MeshInstanceScale,
} from '../../entities/chunkedMeshGeometry';
import { recordChunkCompilerMetrics } from './chunkCompilerMetrics';
import { MeshCompiler } from './MeshCompiler';
import { meshBufferByteLength, unpackMeshGeometry } from './meshBuffers';

let shared: { compiler: MeshCompiler; users: number } | undefined;

function acquireCompiler() {
    const lease = shared ?? { compiler: new MeshCompiler(), users: 0 };
    shared = lease;
    lease.users++;
    return {
        compiler: lease.compiler,
        release: () => {
            lease.users--;
            if (lease.users === 0) {
                lease.compiler.dispose();
                if (shared === lease) shared = undefined;
            }
        },
    };
}

export type CompiledChunkSource = {
    geometry: BufferGeometry;
    instances: ChunkedMeshInstance[];
    localTransform: MeshInstanceLocalTransform;
    scale: MeshInstanceScale;
};

export function useCompiledChunk(
    geometry: BufferGeometry,
    instances: ChunkedMeshInstance[],
    localTransform: MeshInstanceLocalTransform,
    scale: MeshInstanceScale,
) {
    const sources = useMemo(
        () => [{ geometry, instances, localTransform, scale }],
        [geometry, instances, localTransform, scale],
    );
    return useCompiledChunkSources(sources);
}

/**
 * Compiles every source into one owned geometry. The `sources` array identity
 * is the request key, so callers retain it while the packet is unchanged.
 * Retained entity and static-packet inputs are immutable after preparation;
 * any future in-place source edits must advance Three's needsUpdate version.
 */
export function useCompiledChunkSources(
    sources: readonly CompiledChunkSource[],
) {
    const [result, setResult] = useState<{
        sources: readonly CompiledChunkSource[];
        geometry: BufferGeometry;
        durationMs: number;
    }>();
    useLayoutEffect(() => {
        const lease = acquireCompiler();
        let owned: BufferGeometry | undefined;
        let bytes = 0;
        let cancelled = false;
        setResult(undefined);
        const cancel = lease.compiler.request(
            sources.map(({ geometry, instances, localTransform, scale }) => ({
                geometry,
                matrices: createChunkMatrices(instances, localTransform, scale),
            })),
            (packet, durationMs) => {
                if (!packet || cancelled) return;
                owned = unpackMeshGeometry(packet);
                bytes = meshBufferByteLength(packet);
                recordChunkCompilerMetrics((metrics) => {
                    metrics.liveGeometries++;
                    metrics.liveGeometryBytes += bytes;
                    metrics.peakGeometryBytes = Math.max(
                        metrics.peakGeometryBytes,
                        metrics.liveGeometryBytes,
                    );
                });
                setResult({ sources, geometry: owned, durationMs });
            },
            'versioned',
        );
        return () => {
            cancelled = true;
            cancel();
            if (owned) {
                owned.dispose();
                recordChunkCompilerMetrics((metrics) => {
                    metrics.liveGeometries--;
                    metrics.liveGeometryBytes -= bytes;
                    metrics.disposedGeometries++;
                });
            }
            lease.release();
        };
    }, [sources]);
    return result?.sources === sources ? result : undefined;
}
