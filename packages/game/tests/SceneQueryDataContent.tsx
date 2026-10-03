import { SceneBlockDataBoundary } from '../src/scene/SceneBlockDataBoundary';
import { SceneQueryDataLeaf } from './SceneQueryDataLeaf';
import { SceneQueryDataRawLeaf } from './SceneQueryDataRawLeaf';
import { SceneQueryDataSuspenseGate } from './SceneQueryDataSuspenseGate';
import type {
    createSceneQueryGate,
    SceneQueryDataMode,
} from './sceneQueryDataWitness';

export function SceneQueryDataContent({
    mode,
    gate,
    leafCount,
}: {
    mode: SceneQueryDataMode;
    gate: ReturnType<typeof createSceneQueryGate>;
    leafCount: number;
}) {
    if (mode === 'empty') return null;
    const indices = Array.from({ length: leafCount }, (_, index) => index);
    if (mode === 'raw-fanout') {
        return indices.map((index) => (
            <SceneQueryDataRawLeaf key={index} index={index} />
        ));
    }
    return (
        <SceneBlockDataBoundary>
            <SceneQueryDataSuspenseGate gate={gate} />
            <SceneBlockDataBoundary>
                {indices.map((index) => (
                    <SceneQueryDataLeaf key={index} index={index} />
                ))}
            </SceneBlockDataBoundary>
        </SceneBlockDataBoundary>
    );
}
