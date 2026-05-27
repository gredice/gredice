import { type MutableRefObject, useEffect, useRef } from 'react';
import { Vector3 } from 'three';
import type { OrbitControls } from 'three-stdlib';
import { animateSunflowerHudToPoint } from '../indicators/SunflowerTransfer/useSunflowerTransferAnimation';
import { useGameState } from '../useGameState';
import { useCurrentGarden } from './useCurrentGarden';

const focusAnimationDurationMs = 650;
const sunflowerAnimationDelayMs = 420;
const reducedMotionQuery = '(prefers-reduced-motion: reduce)';

function easeInOutCubic(progress: number) {
    return progress < 0.5
        ? 4 * progress * progress * progress
        : 1 - (-2 * progress + 2) ** 3 / 2;
}

function prefersReducedMotion() {
    return (
        typeof window !== 'undefined' &&
        typeof window.matchMedia === 'function' &&
        window.matchMedia(reducedMotionQuery).matches
    );
}

function focusOrbitControlsOnPosition({
    animationFrameRef,
    orbitControls,
    targetPosition,
}: {
    animationFrameRef: MutableRefObject<number | null>;
    orbitControls: OrbitControls;
    targetPosition: Vector3;
}) {
    if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
    }

    const offset = new Vector3().subVectors(
        targetPosition,
        orbitControls.target,
    );
    const startTarget = orbitControls.target.clone();
    const endTarget = startTarget.clone().add(offset);
    const startCameraPosition = orbitControls.object.position.clone();
    const endCameraPosition = startCameraPosition.clone().add(offset);

    if (prefersReducedMotion()) {
        orbitControls.target.copy(endTarget);
        orbitControls.object.position.copy(endCameraPosition);
        orbitControls.update();
        return;
    }

    const startTime = performance.now();
    const step = (currentTime: number) => {
        const progress = Math.min(
            (currentTime - startTime) / focusAnimationDurationMs,
            1,
        );
        const easedProgress = easeInOutCubic(progress);

        orbitControls.target.lerpVectors(startTarget, endTarget, easedProgress);
        orbitControls.object.position.lerpVectors(
            startCameraPosition,
            endCameraPosition,
            easedProgress,
        );
        orbitControls.update();

        if (progress < 1) {
            animationFrameRef.current = window.requestAnimationFrame(step);
            return;
        }

        animationFrameRef.current = null;
    };

    animationFrameRef.current = window.requestAnimationFrame(step);
}

function getWorldScreenPoint({
    orbitControls,
    position,
}: {
    orbitControls: OrbitControls;
    position: Vector3;
}) {
    if (!orbitControls.domElement) {
        return null;
    }

    const rect = orbitControls.domElement.getBoundingClientRect();
    const projected = position.clone().project(orbitControls.object);

    return {
        x: rect.left + ((projected.x + 1) / 2) * rect.width,
        y: rect.top + ((-projected.y + 1) / 2) * rect.height,
    };
}

export function useFocusPlacedBlock() {
    const { data: garden } = useCurrentGarden();
    const orbitControls = useGameState((state) => state.orbitControls);
    const consumePlacedBlockEffect = useGameState(
        (state) => state.consumePlacedBlockEffect,
    );

    const previousPlacements = useRef<Set<string> | null>(null);
    const animationFrameRef = useRef<number | null>(null);
    const sunflowerTimeoutsRef = useRef<number[]>([]);

    useEffect(() => {
        return () => {
            if (animationFrameRef.current !== null) {
                window.cancelAnimationFrame(animationFrameRef.current);
            }
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

        if (newPlacements.length > 0 && orbitControls) {
            const latestPlacement = newPlacements.at(-1);
            if (latestPlacement?.position) {
                const targetPosition = latestPlacement.position.clone();
                focusOrbitControlsOnPosition({
                    animationFrameRef,
                    orbitControls,
                    targetPosition,
                });
            }

            for (const placement of newPlacements) {
                const effect = consumePlacedBlockEffect(placement.block.id);
                if (effect?.kind !== 'sunflowers') {
                    continue;
                }

                const timeoutId = window.setTimeout(
                    () => {
                        const target = getWorldScreenPoint({
                            orbitControls,
                            position: placement.position,
                        });
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
    }, [consumePlacedBlockEffect, garden, orbitControls]);
}
