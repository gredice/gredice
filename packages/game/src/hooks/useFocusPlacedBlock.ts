import { type MutableRefObject, useEffect, useRef } from 'react';
import { Vector3 } from 'three';
import type { OrbitControls } from 'three-stdlib';
import { animateSunflowerHudToPoint } from '../indicators/SunflowerTransfer/useSunflowerTransferAnimation';
import { useGameState } from '../useGameState';
import { useCurrentGarden } from './useCurrentGarden';

const focusAnimationDurationMs = 650;
const focusFollowTimeConstantMs = focusAnimationDurationMs / 4;
const sunflowerAnimationDelayMs = 420;
const reducedMotionQuery = '(prefers-reduced-motion: reduce)';
const focusStopDistance = 0.01;

type FocusAnimationState = {
    cameraPosition: Vector3;
    lastFrameTime: number | null;
    orbitControls: OrbitControls;
    targetPosition: Vector3;
};

function prefersReducedMotion() {
    return (
        typeof window !== 'undefined' &&
        typeof window.matchMedia === 'function' &&
        window.matchMedia(reducedMotionQuery).matches
    );
}

function stepFocusAnimation({
    animationFrameRef,
    focusAnimationRef,
}: {
    animationFrameRef: MutableRefObject<number | null>;
    focusAnimationRef: MutableRefObject<FocusAnimationState | null>;
}) {
    const step = (currentTime: number) => {
        const state = focusAnimationRef.current;
        if (!state) {
            animationFrameRef.current = null;
            return;
        }

        const deltaMs =
            state.lastFrameTime === null
                ? 16.67
                : Math.min(currentTime - state.lastFrameTime, 100);
        state.lastFrameTime = currentTime;

        const alpha = 1 - Math.exp(-deltaMs / focusFollowTimeConstantMs);
        state.orbitControls.target.lerp(state.targetPosition, alpha);
        state.orbitControls.object.position.lerp(state.cameraPosition, alpha);
        state.orbitControls.update();

        const targetDistance = state.orbitControls.target.distanceTo(
            state.targetPosition,
        );
        const cameraDistance = state.orbitControls.object.position.distanceTo(
            state.cameraPosition,
        );

        if (
            targetDistance <= focusStopDistance &&
            cameraDistance <= focusStopDistance
        ) {
            state.orbitControls.target.copy(state.targetPosition);
            state.orbitControls.object.position.copy(state.cameraPosition);
            state.orbitControls.update();
            focusAnimationRef.current = null;
            animationFrameRef.current = null;
            return;
        }

        animationFrameRef.current = window.requestAnimationFrame(step);
    };

    animationFrameRef.current = window.requestAnimationFrame(step);
}

function focusOrbitControlsOnPosition({
    animationFrameRef,
    focusAnimationRef,
    orbitControls,
    targetPosition,
}: {
    animationFrameRef: MutableRefObject<number | null>;
    focusAnimationRef: MutableRefObject<FocusAnimationState | null>;
    orbitControls: OrbitControls;
    targetPosition: Vector3;
}) {
    const cameraOffset = new Vector3().subVectors(
        orbitControls.object.position,
        orbitControls.target,
    );
    const nextTargetPosition = targetPosition.clone();
    const nextCameraPosition = targetPosition.clone().add(cameraOffset);

    if (prefersReducedMotion()) {
        if (animationFrameRef.current !== null) {
            window.cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
        }

        focusAnimationRef.current = null;
        orbitControls.target.copy(nextTargetPosition);
        orbitControls.object.position.copy(nextCameraPosition);
        orbitControls.update();
        return;
    }

    focusAnimationRef.current = {
        cameraPosition: nextCameraPosition,
        lastFrameTime: focusAnimationRef.current?.lastFrameTime ?? null,
        orbitControls,
        targetPosition: nextTargetPosition,
    };

    if (animationFrameRef.current === null) {
        stepFocusAnimation({ animationFrameRef, focusAnimationRef });
    }
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
    const focusAnimationRef = useRef<FocusAnimationState | null>(null);
    const animationFrameRef = useRef<number | null>(null);
    const sunflowerTimeoutsRef = useRef<number[]>([]);

    useEffect(() => {
        return () => {
            if (animationFrameRef.current !== null) {
                window.cancelAnimationFrame(animationFrameRef.current);
            }
            focusAnimationRef.current = null;
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
                    focusAnimationRef,
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
