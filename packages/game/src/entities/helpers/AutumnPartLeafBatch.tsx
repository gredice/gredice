import { useFrame } from '@react-three/fiber';
import { useCallback, useLayoutEffect, useRef } from 'react';
import { type InstancedMesh, Vector3 } from 'three';
import { useAutumnSources } from '../../scene/AutumnSources';
import { useAutumnLeafBatchResources } from '../groundDecorations/AutumnLeafBatch';
import {
    type AutumnPartCandidate,
    type AutumnPartLeafPlacement,
    getAutumnVisibleSurfaceCount,
} from './autumnEntityPlacements';
import { createAutumnPartLeafInstanceMatrix } from './autumnPartMatrices';

/** The scene spring runtime writes animated groups before R3F frame subscribers.
 * Read the actual rendered part here, before this frame is submitted.
 */
export function AutumnPartLeafBatch({
    placements,
    variant,
    onCount,
    amount,
    snow,
}: {
    placements: readonly AutumnPartLeafPlacement[];
    variant: number;
    onCount: (variant: number, count: number) => void;
    amount: number;
    snow: number;
}) {
    const ref = useRef<InstancedMesh>(null);
    const previousCount = useRef(-1);
    const { geometry, material } = useAutumnLeafBatchResources(0, 0, variant);
    const sources = useAutumnSources();
    const writeMatrices = useCallback(() => {
        const mesh = ref.current;
        if (!mesh) return;
        mesh.updateWorldMatrix(true, false);
        const treePosition = new Vector3();
        const trees = sources.map(({ id, object }) => {
            object.updateWorldMatrix(true, false);
            object.getWorldPosition(treePosition);
            return { id, x: treePosition.x, z: treePosition.z };
        });
        const visibleCountByPart = new Map<AutumnPartCandidate, number>();
        let count = 0;
        for (const placement of placements) {
            const object = placement.part.object;
            if (!object) continue;
            object.updateWorldMatrix(true, false);
            let visibleCount = visibleCountByPart.get(placement.part);
            if (visibleCount === undefined) {
                const origin = new Vector3().setFromMatrixPosition(
                    object.matrixWorld,
                );
                visibleCount = getAutumnVisibleSurfaceCount(
                    placement.surfaceCount,
                    origin.x,
                    origin.z,
                    trees,
                    amount,
                    snow,
                );
                visibleCountByPart.set(placement.part, visibleCount);
            }
            if (placement.rank >= visibleCount) continue;
            const matrix = createAutumnPartLeafInstanceMatrix(
                mesh.matrixWorld,
                object.matrixWorld,
                placement.surface,
            );
            if (!matrix) continue;
            mesh.setMatrixAt(count++, matrix);
        }
        mesh.count = count;
        mesh.instanceMatrix.needsUpdate = true;
        if (previousCount.current !== count) {
            previousCount.current = count;
            onCount(variant, count);
        }
    }, [amount, onCount, placements, snow, sources, variant]);
    useLayoutEffect(() => {
        if (ref.current) ref.current.raycast = () => {};
        writeMatrices();
        return () => onCount(variant, 0);
    }, [onCount, variant, writeMatrices]);
    useFrame(writeMatrices, -1);
    return (
        <instancedMesh
            ref={ref}
            args={[geometry, material, placements.length]}
            castShadow={false}
            receiveShadow
            renderOrder={1}
            frustumCulled={false}
            name={`BlockInstances:Autumn:part:${variant}`}
        />
    );
}
