import {
    compileMeshBufferSources,
    meshBufferByteLength,
    type PackedMeshGeometry,
} from './meshBuffers';
import {
    type MeshCompilerRequest,
    type MeshCompilerResponse,
    meshCompilerSourceCacheByteLimit,
    meshCompilerSourceCacheEntryLimit,
} from './meshCompilerProtocol';

/** Worker-owned packets are read-only. Outputs always allocate separate storage. */
export function createMeshCompilerWorkerRuntime() {
    const sources = new Map<number, PackedMeshGeometry>();
    let retainedBytes = 0;
    return {
        readRetainedBytes: () => retainedBytes,
        handle(message: MeshCompilerRequest): MeshCompilerResponse | undefined {
            if (message.type === 'release') {
                for (const id of message.sourceIds) {
                    const source = sources.get(id);
                    if (source) retainedBytes -= meshBufferByteLength(source);
                    sources.delete(id);
                }
                return;
            }
            const started = performance.now();
            try {
                const resolved = message.sources.map(
                    ({ sourceId, source, matrices }) => {
                        if (sourceId !== undefined && source) {
                            if (sources.has(sourceId))
                                throw Error(
                                    'Duplicate compiler source registration',
                                );
                            const bytes = meshBufferByteLength(source);
                            if (
                                sources.size >=
                                    meshCompilerSourceCacheEntryLimit ||
                                retainedBytes + bytes >
                                    meshCompilerSourceCacheByteLimit
                            )
                                throw Error(
                                    'Compiler source cache exceeds its byte limit',
                                );
                            sources.set(sourceId, source);
                            retainedBytes += bytes;
                        }
                        const registered =
                            sourceId === undefined
                                ? source
                                : sources.get(sourceId);
                        if (!registered)
                            throw Error('Missing compiler source registration');
                        return { source: registered, matrices };
                    },
                );
                return {
                    id: message.id,
                    packet: compileMeshBufferSources(resolved),
                    durationMs: performance.now() - started,
                };
            } catch (error) {
                return {
                    id: message.id,
                    durationMs: performance.now() - started,
                    error: String(error),
                };
            }
        },
    };
}
