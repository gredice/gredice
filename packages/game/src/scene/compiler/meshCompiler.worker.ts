import {
    compileMeshBuffers,
    meshBufferTransferables,
    type PackedMeshGeometry,
} from './meshBuffers';

export type MeshCompilerRequest = {
    id: number;
    source: PackedMeshGeometry;
    matrices: Float64Array;
};
export type MeshCompilerResponse = {
    id: number;
    packet?: PackedMeshGeometry;
    durationMs: number;
    error?: string;
};

declare const self: {
    onmessage: ((event: MessageEvent<MeshCompilerRequest>) => void) | null;
    postMessage: (
        response: MeshCompilerResponse,
        transfer: Transferable[],
    ) => void;
};
self.onmessage = ({ data }: MessageEvent<MeshCompilerRequest>) => {
    const started = performance.now();
    try {
        const packet = compileMeshBuffers(data.source, data.matrices);
        self.postMessage(
            { id: data.id, packet, durationMs: performance.now() - started },
            meshBufferTransferables(packet),
        );
    } catch (error) {
        self.postMessage(
            {
                id: data.id,
                durationMs: performance.now() - started,
                error: String(error),
            },
            [],
        );
    }
};
