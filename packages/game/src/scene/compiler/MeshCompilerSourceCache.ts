import type { BufferGeometry } from 'three';
import { recordChunkCompilerMetrics } from './chunkCompilerMetrics';
import {
    clonePackedMeshGeometry,
    meshBufferByteLength,
    type PackedMeshGeometry,
    packMeshGeometry,
} from './meshBuffers';
import {
    type MeshCompilerSourceRequest,
    meshCompilerSourceCacheByteLimit,
    meshCompilerSourceCacheEntryLimit,
} from './meshCompilerProtocol';
import {
    type MeshSourceVersion,
    meshSourceVersion,
    meshSourceVersionMatches,
} from './meshSourceVersion';

export type MeshCompilerSourcePolicy = 'uncached' | 'versioned';

type SourceEntry = {
    id: number;
    geometry: BufferGeometry;
    version: MeshSourceVersion;
    packet?: PackedMeshGeometry;
    workerBytes: number;
    onDispose: () => void;
};

/** Separate read-only main and worker ownership; in-flight worker sources stay pinned. */
export class MeshCompilerSourceCache {
    private entries = new Map<BufferGeometry, SourceEntry>();
    private retired = new Set<SourceEntry>();
    private nextSourceId = 0;
    private retainedBytes = 0;
    private byteLimit: number;

    constructor(
        private isPinned: (id: number) => boolean,
        private releaseWorkerSource: (id: number) => void,
        byteLimit = meshCompilerSourceCacheByteLimit,
    ) {
        this.byteLimit = Math.max(
            0,
            Math.min(byteLimit, meshCompilerSourceCacheByteLimit),
        );
    }

    private changeBytes(delta: number) {
        this.retainedBytes += delta;
        recordChunkCompilerMetrics((metrics) => {
            metrics.retainedSourceBytes += delta;
            metrics.peakSourceBytes = Math.max(
                metrics.peakSourceBytes,
                metrics.retainedSourceBytes,
            );
        });
    }

    private pack(geometry: BufferGeometry) {
        const started = performance.now();
        const packet = packMeshGeometry(geometry);
        const duration = performance.now() - started;
        recordChunkCompilerMetrics((metrics) => {
            metrics.sourcePacks++;
            metrics.sourcePackBytes += meshBufferByteLength(packet);
            metrics.sourcePackMs += duration;
            metrics.sourcePackMaxMs = Math.max(
                metrics.sourcePackMaxMs,
                duration,
            );
        });
        return packet;
    }

    private find(geometry: BufferGeometry) {
        const entry = this.entries.get(geometry);
        if (!entry) return;
        if (!meshSourceVersionMatches(entry.version, geometry)) {
            this.remove(entry);
            return;
        }
        // Map order is the bounded LRU; hits keep their source resident.
        this.entries.delete(geometry);
        this.entries.set(geometry, entry);
        return entry;
    }

    private add(geometry: BufferGeometry): SourceEntry {
        const entry: SourceEntry = {
            id: ++this.nextSourceId,
            geometry,
            version: meshSourceVersion(geometry),
            workerBytes: 0,
            onDispose: () => this.remove(entry),
        };
        geometry.addEventListener('dispose', entry.onDispose);
        this.entries.set(geometry, entry);
        return entry;
    }

    private remove(entry: SourceEntry) {
        if (this.entries.get(entry.geometry) === entry)
            this.entries.delete(entry.geometry);
        entry.geometry.removeEventListener('dispose', entry.onDispose);
        if (entry.packet) {
            this.changeBytes(-meshBufferByteLength(entry.packet));
            entry.packet = undefined;
        }
        if (entry.workerBytes && this.isPinned(entry.id)) {
            // Disposal or a new source version cannot remove an active job's source.
            this.retired.add(entry);
            return;
        }
        if (entry.workerBytes) {
            const bytes = entry.workerBytes;
            entry.workerBytes = 0;
            this.changeBytes(-bytes);
            this.releaseWorkerSource(entry.id);
        }
        this.retired.delete(entry);
    }

    private reserve(bytes: number, keep?: SourceEntry) {
        if (bytes > this.byteLimit) return false;
        while (
            this.retainedBytes + bytes > this.byteLimit ||
            this.entries.size + this.retired.size + (keep ? 0 : 1) >
                meshCompilerSourceCacheEntryLimit
        ) {
            const victim = Array.from(this.entries.values()).find(
                (entry) => entry !== keep && !this.isPinned(entry.id),
            );
            if (!victim) return false;
            this.remove(victim);
            recordChunkCompilerMetrics((metrics) => {
                metrics.sourceCacheEvictions++;
            });
        }
        return true;
    }

    synchronous(geometry: BufferGeometry, policy: MeshCompilerSourcePolicy) {
        if (policy === 'uncached') return this.pack(geometry);
        let entry = this.find(geometry);
        if (entry?.packet) {
            recordChunkCompilerMetrics((metrics) => {
                metrics.sourceCacheHits++;
            });
            return entry.packet;
        }
        recordChunkCompilerMetrics((metrics) => {
            metrics.sourceCacheMisses++;
        });
        const packet = this.pack(geometry);
        const bytes = meshBufferByteLength(packet);
        if (bytes && this.reserve(bytes, entry)) {
            entry ??= this.add(geometry);
            entry.packet = packet;
            this.changeBytes(bytes);
        }
        return packet;
    }

    worker(
        geometry: BufferGeometry,
        policy: MeshCompilerSourcePolicy,
    ): Omit<MeshCompilerSourceRequest, 'matrices'> {
        if (policy === 'uncached') return { source: this.pack(geometry) };
        let entry = this.find(geometry);
        if (entry?.workerBytes) {
            recordChunkCompilerMetrics((metrics) => {
                metrics.sourceCacheHits++;
            });
            return { sourceId: entry.id };
        }
        recordChunkCompilerMetrics((metrics) => {
            metrics.sourceCacheMisses++;
        });
        // Never transfer the main-thread packet: synchronous jobs may still use it.
        const packet = entry?.packet
            ? clonePackedMeshGeometry(entry.packet)
            : this.pack(geometry);
        const bytes = meshBufferByteLength(packet);
        if (!bytes || !this.reserve(bytes, entry)) return { source: packet };
        entry ??= this.add(geometry);
        entry.workerBytes = bytes;
        this.changeBytes(bytes);
        return { sourceId: entry.id, source: packet };
    }

    releaseUnpinned() {
        for (const entry of this.retired)
            if (!this.isPinned(entry.id)) this.remove(entry);
    }

    resetWorker() {
        for (const entry of [...this.entries.values(), ...this.retired]) {
            if (entry.workerBytes) {
                this.changeBytes(-entry.workerBytes);
                entry.workerBytes = 0;
            }
            if (!entry.packet) this.remove(entry);
        }
    }

    dispose() {
        for (const entry of [...this.entries.values(), ...this.retired]) {
            entry.geometry.removeEventListener('dispose', entry.onDispose);
        }
        this.entries.clear();
        this.retired.clear();
        this.changeBytes(-this.retainedBytes);
    }
}
