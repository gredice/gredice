import type { BlockData } from '@gredice/client';
import { useEffect, useMemo, useRef } from 'react';
import type { Stack } from '../../types/Stack';
import { recordChunkCompilerMetrics } from './chunkCompilerMetrics';
import {
    compileRetainedGardenScene,
    type RetainedGardenScene,
} from './retainedGardenScene';

export function useRetainedGardenScene(
    stacks: Stack[] | undefined,
    catalog: BlockData[] | null | undefined,
) {
    const previous = useRef<RetainedGardenScene | undefined>(undefined);
    const build = useMemo(() => {
        const started = performance.now();
        const scene = compileRetainedGardenScene(
            stacks,
            catalog,
            previous.current,
        );
        return { scene, duration: performance.now() - started };
    }, [stacks, catalog]);
    useEffect(() => {
        previous.current = build.scene;
        recordChunkCompilerMetrics((metrics) => {
            metrics.sceneReconciliations++;
            metrics.sceneRebuilds +=
                build.scene.dirtyChunkKeys.length > 0 ? 1 : 0;
            metrics.dirtyChunks += build.scene.dirtyChunkKeys.length;
            metrics.retainedChunks = build.scene.chunks.length;
            metrics.reconcileMaxMs = Math.max(
                metrics.reconcileMaxMs,
                build.duration,
            );
        });
    }, [build]);
    return build.scene;
}
