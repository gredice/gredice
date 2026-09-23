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

export function useCompiledChunk(
    geometry: BufferGeometry,
    instances: ChunkedMeshInstance[],
    localTransform: MeshInstanceLocalTransform,
    scale: MeshInstanceScale,
) {
    const request = useMemo(
        () => ({ geometry, instances, localTransform, scale }),
        [geometry, instances, localTransform, scale],
    );
    const [result, setResult] = useState<{
        request: typeof request;
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
            geometry,
            createChunkMatrices(instances, localTransform, scale),
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
                setResult({ request, geometry: owned, durationMs });
            },
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
    }, [request, geometry, instances, localTransform, scale]);
    return result?.request === request ? result : undefined;
}
