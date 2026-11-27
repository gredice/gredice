import { useEffect, useRef } from 'react';
import { Vector3 } from 'three';
import { animateSunflowerHudToPoint } from '../indicators/SunflowerTransfer/useSunflowerTransferAnimation';
import { useGameState } from '../useGameState';
import { useCurrentGarden } from './useCurrentGarden';

const sunflowerAnimationDelayMs = 420;
const reducedMotionQuery = '(prefers-reduced-motion: reduce)';

function prefersReducedMotion() {
    return (
        typeof window !== 'undefined' &&
        typeof window.matchMedia === 'function' &&
        window.matchMedia(reducedMotionQuery).matches
    );
}

/**
 * Where the camera goes after blocks appear. Several new blocks next to
 * blocks that were already there (an Expand batch) focus the middle of the
 * placed area; one new block, or a garden whose blocks are all new (another
 * garden loaded), focuses the latest block as before.
 */
function getPlacedBlocksFocusPoint(
    newPositions: readonly Vector3[],
    totalPlacementCount: number,
) {
    const latest = newPositions.at(-1);
    if (
        !latest ||
        newPositions.length === 1 ||
        newPositions.length >= totalPlacementCount
    ) {
        return latest?.clone() ?? null;
    }

    const centroid = new Vector3();
    for (const position of newPositions) {
        centroid.add(position);
    }
    return centroid.divideScalar(newPositions.length);
}

export function useFocusPlacedBlock() {
    const { data: garden } = useCurrentGarden();
    const gameCamera = useGameState((state) => state.gameCamera);
    const consumePlacedBlockEffect = useGameState(
        (state) => state.consumePlacedBlockEffect,
    );

    const previousPlacements = useRef<Set<string> | null>(null);
    const sunflowerTimeoutsRef = useRef<number[]>([]);

    useEffect(() => {
        return () => {
            for (const timeoutId of sunflowerTimeoutsRef.current) {
                window.clearTimeout(timeoutId);
            }
            sunflowerTimeoutsRef.current = [];
        };
    }, []);

    useEffect(() => {
        if (!garden) return;

        const placementEntries = garden.stacks.flatMap((stack) =>
            stack.blocks.map((block) => ({
                key: block.id,
                block,
                position: new Vector3(
                    stack.position.x,
                    stack.position.y,
                    stack.position.z,
                ),
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

        if (newPlacements.length > 0 && gameCamera) {
            const focusPoint = getPlacedBlocksFocusPoint(
                newPlacements.map((placement) => placement.position),
                placementEntries.length,
            );
            if (focusPoint) {
                gameCamera.focus(focusPoint, {
                    immediate: prefersReducedMotion(),
                });
            }

            for (const placement of newPlacements) {
                const effect = consumePlacedBlockEffect(placement.block.id);
                if (effect?.kind !== 'sunflowers') {
                    continue;
                }

                const timeoutId = window.setTimeout(
                    () => {
                        const target = gameCamera.projectToScreen(
                            placement.position,
                        );
                        if (!target) {
                            return;
                        }

                        animateSunflowerHudToPoint({
                            amount: effect.amount,
                            to: target,
                        });
                    },
                    prefersReducedMotion() ? 0 : sunflowerAnimationDelayMs,
                );
                sunflowerTimeoutsRef.current.push(timeoutId);
            }
        }

        previousPlacements.current = currentPlacements;
    }, [consumePlacedBlockEffect, gameCamera, garden]);
}
