import type { createLadybugSuspenseGate } from './ladybugSuspenseWitness';

/** A late sibling resource uses the same Suspense mechanism as GLTF loading. */
export function LadybugLateResource({
    gate,
}: {
    gate: ReturnType<typeof createLadybugSuspenseGate>;
}) {
    gate.read();
    return null;
}
