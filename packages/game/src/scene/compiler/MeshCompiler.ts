import type { BufferGeometry } from 'three';
import { recordChunkCompilerMetrics } from './chunkCompilerMetrics';
import {
    compileMeshBuffers,
    meshBufferByteLength,
    meshBufferTransferables,
    type PackedMeshGeometry,
    packMeshGeometry,
} from './meshBuffers';
import type {
    MeshCompilerRequest,
    MeshCompilerResponse,
} from './meshCompiler.worker';

export type MeshCompilerWorker = {
    onmessage: ((event: MessageEvent<MeshCompilerResponse>) => void) | null;
    onerror: ((event: ErrorEvent) => void) | null;
    postMessage: (
        message: MeshCompilerRequest,
        transfer: Transferable[],
    ) => void;
    terminate: () => void;
};

type Job = {
    id: number;
    geometry: BufferGeometry;
    matrices: Float64Array;
    deliver: (packet: PackedMeshGeometry | null, durationMs: number) => void;
};

// The benchmark covers the threshold, and total synchronous work is limited per task.
export const synchronousChunkComponentLimit = 8192;
export const synchronousChunkBudgetMs = 2;

/** One worker and one transferred job in flight. Cancelled queued jobs never pack buffers. */
export class MeshCompiler {
    private worker: MeshCompilerWorker | null = null;
    private unavailable = false;
    private disposed = false;
    private nextId = 0;
    private queue: Job[] = [];
    private active: { id: number; deliver: Job['deliver'] | null } | null =
        null;
    private timeout: ReturnType<typeof setTimeout> | undefined;
    private budgetReset: ReturnType<typeof setTimeout> | undefined;
    private syncSpentMs = 0;

    constructor(
        private createWorker: () => MeshCompilerWorker = () =>
            new Worker(new URL('./meshCompiler.worker.ts', import.meta.url), {
                type: 'module',
            }),
    ) {}

    request(
        geometry: BufferGeometry,
        matrices: Float64Array,
        deliver: Job['deliver'],
    ) {
        if (this.disposed) return () => {};
        const components =
            (Object.values(geometry.attributes).reduce(
                (sum, attribute) => sum + attribute.count * attribute.itemSize,
                0,
            ) *
                matrices.length) /
            16;
        if (
            components <= synchronousChunkComponentLimit &&
            this.syncSpentMs < synchronousChunkBudgetMs
        ) {
            const started = performance.now();
            const packet = compileMeshBuffers(
                packMeshGeometry(geometry),
                matrices,
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
        const job = { id: ++this.nextId, geometry, matrices, deliver };
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
        this.unavailable = true;
        const active = this.active;
        this.active = null;
        active?.deliver?.(null, 0);
        for (const job of this.queue.splice(0)) job.deliver(null, 0);
        recordChunkCompilerMetrics((metrics) => {
            metrics.workerFailures++;
        });
        this.publishPending();
    }

    private dispatch() {
        if (this.active || this.disposed || this.queue.length === 0) return;
        if (this.unavailable) {
            for (const job of this.queue.splice(0)) job.deliver(null, 0);
            this.publishPending();
            return;
        }
        try {
            if (!this.worker) {
                this.worker = this.createWorker();
                this.worker.onerror = () => this.fail();
                this.worker.onmessage = ({ data }) => {
                    if (this.disposed) return;
                    if (data.id !== this.active?.id) {
                        recordChunkCompilerMetrics((metrics) => {
                            metrics.staleResults++;
                        });
                        return;
                    }
                    clearTimeout(this.timeout);
                    const deliver = this.active.deliver;
                    this.active = null;
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
                        if (data.error) metrics.workerFailures++;
                    });
                    deliver?.(data.packet ?? null, data.durationMs);
                    this.publishPending();
                    this.dispatch();
                };
            }
            const job = this.queue.shift();
            if (!job) return;
            this.active = { id: job.id, deliver: job.deliver };
            const started = performance.now();
            const source = packMeshGeometry(job.geometry);
            const bytes =
                meshBufferByteLength(source) + job.matrices.byteLength;
            this.worker.postMessage(
                { id: job.id, source, matrices: job.matrices },
                [...meshBufferTransferables(source), job.matrices.buffer],
            );
            recordChunkCompilerMetrics((metrics) => {
                metrics.transferredBytes += bytes;
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
        this.queue.length = 0;
        this.publishPending();
    }
}
