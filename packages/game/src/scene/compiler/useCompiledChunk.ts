import { useStore } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { BufferGeometry } from 'three';
import {
    type ChunkedMeshInstance,
    createChunkMatrices,
    type MeshInstanceLocalTransform,
    type MeshInstanceScale,
} from '../../entities/chunkedMeshGeometry';
import { useSceneRenderRequest } from '../SceneTime';
import { getSceneRootRuntime } from '../sceneRootRuntime';
import { recordChunkCompilerMetrics } from './chunkCompilerMetrics';
import { chunkCompilerProfileObserver } from './chunkCompilerProfile';
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
 */
export function useCompiledChunkSources(
    sources: readonly CompiledChunkSource[],
) {
    const geometryUpdates = getSceneRootRuntime(useStore()).geometryUpdates;
    const requestRender = useSceneRenderRequest();
    const requestRenderRef = useRef(requestRender);
    requestRenderRef.current = requestRender;
    const [result, setResult] = useState<{
        sources: readonly CompiledChunkSource[];
        geometry: BufferGeometry;
        durationMs: number;
        finishGeometryUpdate: (committed?: boolean) => boolean;
    }>();
    useLayoutEffect(() => {
        const lease = acquireCompiler();
        const finishGeometryUpdate = geometryUpdates.begin();
        const abandonGeometryUpdate = () => {
            if (finishGeometryUpdate())
                requestRenderRef.current('compiled-geometry-fallback', 1);
        };
        let owned: BufferGeometry | undefined;
        let bytes = 0;
        let cancelled = false;
        let cancel: (() => void) | undefined;
        try {
            setResult(undefined);
            const preparationStartedAt = performance.now();
            const preparedSources = sources.map(
                ({ geometry, instances, localTransform, scale }) => ({
                    geometry,
                    matrices: createChunkMatrices(
                        instances,
                        localTransform,
                        scale,
                    ),
                }),
            );
            const preparationMs = performance.now() - preparationStartedAt;
            chunkCompilerProfileObserver()?.({
                stage: 'prepare',
                durationMs: preparationMs,
                instances: sources.reduce(
                    (count, source) => count + source.instances.length,
                    0,
                ),
                sources: sources.length,
            });
            recordChunkCompilerMetrics((metrics) => {
                metrics.matrixPreparationMs += preparationMs;
                metrics.matrixPreparationMaxMs = Math.max(
                    metrics.matrixPreparationMaxMs,
                    preparationMs,
                );
                metrics.matrixPreparationInstances += sources.reduce(
                    (count, source) => count + source.instances.length,
                    0,
                );
                metrics.matrixPreparationBatches++;
            });
            cancel = lease.compiler.request(
                preparedSources,
                (packet, durationMs) => {
                    if (!packet || cancelled) {
                        abandonGeometryUpdate();
                        return;
                    }
                    try {
                        const observer = chunkCompilerProfileObserver();
                        const unpackStartedAt = observer
                            ? performance.now()
                            : 0;
                        owned = unpackMeshGeometry(packet);
                        observer?.({
                            stage: 'unpack',
                            durationMs: performance.now() - unpackStartedAt,
                        });
                        bytes = meshBufferByteLength(packet);
                        recordChunkCompilerMetrics((metrics) => {
                            metrics.liveGeometries++;
                            metrics.liveGeometryBytes += bytes;
                            metrics.peakGeometryBytes = Math.max(
                                metrics.peakGeometryBytes,
                                metrics.liveGeometryBytes,
                            );
                        });
                        setResult({
                            sources,
                            geometry: owned,
                            durationMs,
                            finishGeometryUpdate,
                        });
                    } catch (error) {
                        abandonGeometryUpdate();
                        throw error;
                    }
                },
            );
        } catch (error) {
            abandonGeometryUpdate();
            lease.release();
            throw error;
        }
        return () => {
            cancelled = true;
            cancel?.();
            abandonGeometryUpdate();
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
    }, [geometryUpdates, sources]);
    const current = result?.sources === sources ? result : undefined;
    useLayoutEffect(() => {
        if (current?.finishGeometryUpdate(true))
            requestRenderRef.current('compiled-geometry-ready', 1);
    }, [current]);
    return useMemo(
        () =>
            current
                ? {
                      sources: current.sources,
                      geometry: current.geometry,
                      durationMs: current.durationMs,
                  }
                : undefined,
        [current],
    );
}
