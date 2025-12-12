import { useEffect, useRef } from 'react';
import { Vector3 } from 'three';
import { useGameState } from '../useGameState';
import { useCurrentGarden } from './useCurrentGarden';

function getPlacementKey({
    position,
    index,
}: {
    position: { x: number; z: number };
    index: number;
}) {
    return `${position.x}:${position.z}:${index}`;
}

export function useFocusPlacedBlock() {
    const { data: garden } = useCurrentGarden();
    const orbitControls = useGameState((state) => state.orbitControls);

    const previousPlacements = useRef<Set<string> | null>(null);

    useEffect(() => {
        if (!garden) return;

        const placementEntries = garden.stacks.flatMap((stack) =>
            stack.blocks.map((block, index) => ({
                key: getPlacementKey({
                    position: stack.position,
                    index,
                }),
                block,
                position: stack.position,
            })),
        );

        const currentPlacements = new Set(
            placementEntries.map((entry) => entry.key),
        );

        if (previousPlacements.current === null) {
            previousPlacements.current = currentPlacements;
            return;
        }

        const newPlacements = placementEntries.filter(
            (entry) => !previousPlacements.current?.has(entry.key),
        );

        if (newPlacements.length > 0 && orbitControls) {
            const latestPlacement = newPlacements.at(-1);
            if (latestPlacement?.position) {
                const targetPosition = latestPlacement.position;
                const offset = new Vector3().subVectors(
                    targetPosition,
                    orbitControls.target,
                );

                orbitControls.target.add(offset);
                orbitControls.object.position.add(offset);
                orbitControls.update();
            }
        }

        previousPlacements.current = currentPlacements;
    }, [garden, orbitControls]);
}
