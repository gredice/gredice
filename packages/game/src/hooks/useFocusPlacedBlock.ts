import { useEffect, useRef } from 'react';
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
    const setView = useGameState((state) => state.setView);

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

        if (newPlacements.length > 0) {
            const latestPlacement = newPlacements.at(-1);
            if (latestPlacement?.block) {
                setView({ view: 'closeup', block: latestPlacement.block });
            }
        }

        previousPlacements.current = currentPlacements;
    }, [garden, setView]);
}
