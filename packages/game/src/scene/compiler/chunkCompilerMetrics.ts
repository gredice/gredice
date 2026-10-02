import { updateGameProfileMetadata } from '../gameProfileMetadata';

const metrics = {
    sceneReconciliations: 0,
    sceneRebuilds: 0,
    dirtyChunks: 0,
    retainedChunks: 0,
    reconcileMaxMs: 0,
    syncCompiles: 0,
    workerCompiles: 0,
    syncCompileMaxMs: 0,
    workerCompileMaxMs: 0,
    transferMaxMs: 0,
    transferredBytes: 0,
    sourcePacks: 0,
    sourcePackBytes: 0,
    sourcePackMs: 0,
    sourcePackMaxMs: 0,
    sourceRegistrations: 0,
    sourceCacheHits: 0,
    sourceCacheMisses: 0,
    sourceCacheEvictions: 0,
    retainedSourceBytes: 0,
    peakSourceBytes: 0,
    sourceTransferredBytes: 0,
    matrixTransferredBytes: 0,
    workerFailures: 0,
    cancelledJobs: 0,
    staleResults: 0,
    liveGeometryBytes: 0,
    peakGeometryBytes: 0,
    liveGeometries: 0,
    disposedGeometries: 0,
    pendingJobs: 0,
};

export type ChunkCompilerMetrics = typeof metrics;

export function recordChunkCompilerMetrics(
    update: (metrics: ChunkCompilerMetrics) => void,
) {
    update(metrics);
    updateGameProfileMetadata({ chunkCompiler: { ...metrics } });
}

export function readChunkCompilerMetrics() {
    return { ...metrics };
}
