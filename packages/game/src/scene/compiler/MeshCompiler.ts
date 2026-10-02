import type { BufferGeometry } from 'three';
import { recordChunkCompilerMetrics } from './chunkCompilerMetrics';
import {
    MeshCompilerSourceCache,
    type MeshCompilerSourcePolicy,
} from './MeshCompilerSourceCache';
import {
    compileMeshBufferSources,
    meshBufferByteLength,
    meshBufferTransferables,
    meshGeometryComponentCount,
    type PackedMeshGeometry,
} from './meshBuffers';
import type {
    MeshCompilerRequest,
    MeshCompilerResponse,
} from './meshCompiler.worker';
import { meshCompilerSourceCacheByteLimit } from './meshCompilerProtocol';

export type MeshCompilerWorker = {
    onmessage: ((event: MessageEvent<MeshCompilerResponse>) => void) | null;
    onerror: ((event: ErrorEvent) => void) | null;
    postMessage: (
        message: MeshCompilerRequest,
        transfer: Transferable[],
    ) => void;
    terminate: () => void;
};

export type MeshCompilerSource = {
    geometry: BufferGeometry;
    matrices: Float64Array;
};

type Job = {
    id: number;
    sources: MeshCompilerSource[];
    sourcePolicy: MeshCompilerSourcePolicy;
    deliver: (packet: PackedMeshGeometry | null, durationMs: number) => void;
};

// The benchmark covers the threshold, and total synchronous work is limited per task.
export const synchronousChunkComponentLimit = 8192;
export const synchronousChunkBudgetMs = 2;

/**
 * One worker and one transferred job in flight. Cancelled queued jobs never
 * pack buffers. A job may join several source geometries into one packet.
 */
export class MeshCompiler {
    private worker: MeshCompilerWorker | null = null;
    private disposed = false;
    private nextId = 0;
    private queue: Job[] = [];
    private active: {
        id: number;
        deliver: Job['deliver'] | null;
        sourceIds: Set<number>;
    } | null = null;
    private timeout: ReturnType<typeof setTimeout> | undefined;
    private budgetReset: ReturnType<typeof setTimeout> | undefined;
    private syncSpentMs = 0;
    private sourceCache: MeshCompilerSourceCache;

    constructor(
        private createWorker: () => MeshCompilerWorker = () =>
            new Worker(new URL('./meshCompiler.worker.ts', import.meta.url), {
                type: 'module',
            }),
        sourceCacheByteLimit = meshCompilerSourceCacheByteLimit,
    ) {
        this.sourceCache = new MeshCompilerSourceCache(
            (id) => this.active?.sourceIds.has(id) ?? false,
            (id) => {
                const worker = this.worker;
                try {
                    worker?.postMessage(
                        { type: 'release', sourceIds: [id] },
                        [],
                    );
                } catch {
                    // Do not reenter cache mutation while an eviction is running.
                    queueMicrotask(() => {
                        if (!this.disposed && this.worker === worker)
                            this.fail();
                    });
                }
            },
            sourceCacheByteLimit,
        );
    }

    request(
        sources: MeshCompilerSource[],
        deliver: Job['deliver'],
        sourcePolicy: MeshCompilerSourcePolicy = 'uncached',
    ) {
        if (this.disposed) return () => {};
        const components = sources.reduce(
            (total, { geometry, matrices }) =>
                total +
                (meshGeometryComponentCount(geometry) * matrices.length) / 16,
            0,
        );
        if (
            components <= synchronousChunkComponentLimit &&
            this.syncSpentMs < synchronousChunkBudgetMs
        ) {
            const started = performance.now();
            const packet = compileMeshBufferSources(
                sources.map(({ geometry, matrices }) => ({
                    source: this.sourceCache.synchronous(
                        geometry,
                        sourcePolicy,
                    ),
                    matrices,
                })),
            );
            const duration = performance.now() - started;
            this.syncSpentMs += duration;
            if (!this.budgetReset)
                this.budgetReset = setTimeout(() => {
                    this.syncSpentMs = 0;
                    this.budgetReset = undefined;
                }, 0);
            recordChunkCompilerMetrics((metrics) => {
                metrics.syncCompiles++;
                metrics.syncCompileMaxMs = Math.max(
                    metrics.syncCompileMaxMs,
                    duration,
                );
            });
            deliver(packet, duration);
            return () => {};
        }
        const job = { id: ++this.nextId, sources, deliver, sourcePolicy };
        this.queue.push(job);
        this.publishPending();
        this.dispatch();
        return () => {
            const queued = this.queue.findIndex(
                (candidate) => candidate.id === job.id,
            );
            if (queued >= 0) this.queue.splice(queued, 1);
            if (this.active?.id === job.id) this.active.deliver = null;
            if (queued >= 0 || this.active?.id === job.id)
                recordChunkCompilerMetrics((metrics) => {
                    metrics.cancelledJobs++;
                });
            this.publishPending();
        };
    }

    private publishPending() {
        recordChunkCompilerMetrics((metrics) => {
            metrics.pendingJobs = this.queue.length + (this.active ? 1 : 0);
        });
    }

    private fail() {
        clearTimeout(this.timeout);
        this.worker?.terminate();
        this.worker = null;
        const active = this.active;
        this.active = null;
        this.sourceCache.resetWorker();
        const queued = this.queue.splice(0);
        active?.deliver?.(null, 0);
        for (const job of queued) job.deliver(null, 0);
        recordChunkCompilerMetrics((metrics) => {
            metrics.workerFailures++;
        });
        this.publishPending();
    }

    private dispatch() {
        if (this.active || this.disposed || this.queue.length === 0) return;
        try {
            if (!this.worker) {
                const worker = this.createWorker();
                this.worker = worker;
                worker.onerror = () => {
                    if (this.worker === worker) this.fail();
                };
                worker.onmessage = ({ data }) => {
                    if (this.disposed || this.worker !== worker) return;
                    if (data.id !== this.active?.id) {
                        recordChunkCompilerMetrics((metrics) => {
                            metrics.staleResults++;
                        });
                        return;
                    }
                    if (data.error) {
                        this.fail();
                        return;
                    }
                    clearTimeout(this.timeout);
                    const deliver = this.active.deliver;
                    this.active = null;
                    this.sourceCache.releaseUnpinned();
                    recordChunkCompilerMetrics((metrics) => {
                        metrics.workerCompiles++;
                        metrics.workerCompileMaxMs = Math.max(
                            metrics.workerCompileMaxMs,
                            data.durationMs,
                        );
                        if (data.packet)
                            metrics.transferredBytes += meshBufferByteLength(
                                data.packet,
                            );
                        if (!deliver) metrics.staleResults++;
                    });
                    deliver?.(data.packet ?? null, data.durationMs);
                    this.publishPending();
                    this.dispatch();
                };
            }
            const job = this.queue.shift();
            if (!job) return;
            const sourceIds = new Set<number>();
            this.active = { id: job.id, deliver: job.deliver, sourceIds };
            const started = performance.now();
            const sources = job.sources.map(({ geometry, matrices }) => {
                const source = this.sourceCache.worker(
                    geometry,
                    job.sourcePolicy,
                );
                if (source.sourceId !== undefined)
                    sourceIds.add(source.sourceId);
                return { ...source, matrices };
            });
            const sourceBytes = sources.reduce(
                (total, { source }) =>
                    total + (source ? meshBufferByteLength(source) : 0),
                0,
            );
            const matrixBytes = sources.reduce(
                (total, { matrices }) => total + matrices.byteLength,
                0,
            );
            this.worker.postMessage({ type: 'compile', id: job.id, sources }, [
                ...new Set(
                    sources.flatMap(({ source, matrices }) => [
                        ...(source ? meshBufferTransferables(source) : []),
                        matrices.buffer,
                    ]),
                ),
            ]);
            recordChunkCompilerMetrics((metrics) => {
                metrics.transferredBytes += sourceBytes + matrixBytes;
                metrics.sourceTransferredBytes += sourceBytes;
                metrics.matrixTransferredBytes += matrixBytes;
                metrics.sourceRegistrations += sources.filter(
                    ({ sourceId, source }) => sourceId !== undefined && source,
                ).length;
                metrics.transferMaxMs = Math.max(
                    metrics.transferMaxMs,
                    performance.now() - started,
                );
            });
            this.timeout = setTimeout(() => this.fail(), 10_000);
        } catch {
            this.fail();
        }
    }

    dispose() {
        this.disposed = true;
        clearTimeout(this.timeout);
        clearTimeout(this.budgetReset);
        this.worker?.terminate();
        this.worker = null;
        this.active = null;
        this.sourceCache.dispose();
        this.queue.length = 0;
        this.publishPending();
    }
}
