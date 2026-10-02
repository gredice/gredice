import { meshBufferTransferables } from './meshBuffers';
import type {
    MeshCompilerRequest,
    MeshCompilerResponse,
} from './meshCompilerProtocol';
import { createMeshCompilerWorkerRuntime } from './meshCompilerWorkerRuntime';

export type {
    MeshCompilerRequest,
    MeshCompilerResponse,
} from './meshCompilerProtocol';

declare const self: {
    onmessage: ((event: MessageEvent<MeshCompilerRequest>) => void) | null;
    postMessage: (
        response: MeshCompilerResponse,
        transfer: Transferable[],
    ) => void;
};
const runtime = createMeshCompilerWorkerRuntime();
self.onmessage = ({ data }: MessageEvent<MeshCompilerRequest>) => {
    const response = runtime.handle(data);
    if (response)
        self.postMessage(
            response,
            response.packet ? meshBufferTransferables(response.packet) : [],
        );
};
