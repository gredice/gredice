import type { WebGLRenderer } from 'three';
import type { GameProfileMetadata } from './gameProfileMetadata';

export const rendererStatsMeasurementMode = 'post-render-microtask-v1';

type RendererStatsPublisherOptions = {
    enqueue?: (callback: () => void) => void;
    now?: () => number;
    publish: (metadata: GameProfileMetadata) => void;
    readCurrentReceipt?: () => number | undefined;
};

export function createRendererStatsPublisher({
    enqueue = queueMicrotask,
    now = () => performance.now(),
    publish,
    readCurrentReceipt = () => undefined,
}: RendererStatsPublisherOptions) {
    let active = true;
    let receiptCount = 0;
    let scheduled = false;

    return {
        dispose() {
            active = false;
        },
        schedule(gl: WebGLRenderer) {
            if (!active || scheduled) {
                return;
            }
            scheduled = true;
            enqueue(() => {
                scheduled = false;
                if (!active) {
                    return;
                }
                const currentReceipt = readCurrentReceipt();
                receiptCount =
                    Math.max(
                        receiptCount,
                        Number.isInteger(currentReceipt) &&
                            (currentReceipt ?? 0) >= 0
                            ? (currentReceipt ?? 0)
                            : 0,
                    ) + 1;
                publish({
                    rendererGeometries: gl.info.memory.geometries,
                    rendererLines: gl.info.render.lines,
                    rendererPoints: gl.info.render.points,
                    rendererRenderCalls: gl.info.render.calls,
                    rendererShaders: gl.info.programs?.length,
                    rendererStatsMeasurementMode,
                    rendererStatsPublishedAt: now(),
                    rendererStatsReceiptCount: receiptCount,
                    rendererStatsRenderFrame: gl.info.render.frame,
                    rendererTextures: gl.info.memory.textures,
                    rendererTriangles: gl.info.render.triangles,
                });
            });
        },
    };
}
