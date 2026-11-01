export type ChunkCompilerProfileSample = {
    stage:
        | 'write'
        | 'prepare'
        | 'pack'
        | 'transfer'
        | 'worker'
        | 'sync'
        | 'unpack';
    durationMs: number;
    instances?: number;
    sources?: number;
};

declare global {
    var __grediceChunkCompilerObserver:
        | ((sample: ChunkCompilerProfileSample) => void)
        | undefined;
}

/** Opt-in measurements only; normal compilation retains no sample history. */
export function chunkCompilerProfileObserver() {
    const observer = globalThis.__grediceChunkCompilerObserver;
    if (!observer) return undefined;
    return (sample: ChunkCompilerProfileSample) => {
        // Diagnostic consumers must not interrupt transfer/disposal ownership.
        try {
            observer(sample);
        } catch {
            /* Observer failures cannot fail a compiler job. */
        }
    };
}
