import { useEffect, useRef } from 'react';
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

        if (newPlacements.length > 0 && gameCamera) {
            const latestPlacement = newPlacements.at(-1);
            if (latestPlacement?.position) {
                gameCamera.focus(latestPlacement.position.clone(), {
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
