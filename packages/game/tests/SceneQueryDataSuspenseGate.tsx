import type { createSceneQueryGate } from './sceneQueryDataWitness';

export function SceneQueryDataSuspenseGate({
    gate,
}: {
    gate: ReturnType<typeof createSceneQueryGate>;
}) {
    if (gate.pending) throw gate.promise;
    return null;
}
