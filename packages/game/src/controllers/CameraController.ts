'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';
import { useGameState } from '../useGameState';

interface CameraControllerProps {
    isCloseUp: boolean;
    targetPosition?: [number, number, number];
    onAnimationStart?: () => void;
    onAnimationComplete?: () => void;
}

// Cubic ease in-out function for smoother starts and ends
function easeInOutCubic(x: number): number {
    return x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2;
}

export function CameraController({
    isCloseUp,
    targetPosition,
    onAnimationStart,
    onAnimationComplete,
}: CameraControllerProps) {
    const endZoom = 400;

    const { camera } = useThree();
    const controlsRef = useGameState((state) => state.orbitControls);

    // Camera settings
    const animationDuration = 1; // seconds
    const animationStartTime = useRef(0);
    const isAnimating = useRef(false);
    const previousCloseUp = useRef(false);
    const previousTargetPosition = useRef<[number, number, number] | undefined>(
        undefined,
    );

    // Store the original isometric view position (when first entering closeup)
    const isometricPosition = useRef(new THREE.Vector3());
    const isometricTarget = useRef(new THREE.Vector3());
    const isometricZoom = useRef(0);

    // Store animation start and end positions
    const animationStartPosition = useRef(new THREE.Vector3());
    const animationEndPosition = useRef(new THREE.Vector3());

    // Store animation start and end targets (for camera lookAt)
    const animationStartTarget = useRef(new THREE.Vector3());
    const animationEndTarget = useRef(new THREE.Vector3());

    const animationStartZoom = useRef(0);
    const animationEndZoom = useRef(0);

    const currentLookAt = useRef(new THREE.Vector3());

    useFrame((_, delta) => {
        // Check if state changed or target position changed
        const targetPositionChanged =
            isCloseUp &&
            targetPosition &&
            previousTargetPosition.current &&
            (previousTargetPosition.current[0] !== targetPosition[0] ||
                previousTargetPosition.current[1] !== targetPosition[1] ||
                previousTargetPosition.current[2] !== targetPosition[2]);

        if (previousCloseUp.current !== isCloseUp || targetPositionChanged) {
            if (!controlsRef) {
                console.error('No controls ref provided for camera controller');
                return;
            }

            // Set the target position and look target based on the state
            if (isCloseUp && targetPosition) {
                console.debug('Going to close-up view');

                // Only save isometric position when first entering closeup (not when switching between blocks)
                if (!previousCloseUp.current) {
                    isometricPosition.current.copy(camera.position);
                    isometricTarget.current.copy(controlsRef.target);
                    isometricZoom.current = camera.zoom;
                }

                animationEndPosition.current.copy(
                    new THREE.Vector3(
                        targetPosition[0] - 1,
                        camera.position.y,
                        targetPosition[2],
                    ),
                );
                animationEndTarget.current.copy(
                    new THREE.Vector3(...targetPosition),
                );
                animationEndZoom.current = endZoom;
            } else {
                console.debug('Returning to isometric view');
                animationEndPosition.current.copy(isometricPosition.current);
                animationEndTarget.current.copy(isometricTarget.current);
                animationEndZoom.current = isometricZoom.current;
            }

            // Capture current camera position and target as the starting point
            animationStartPosition.current.copy(camera.position);
            animationStartTarget.current.copy(controlsRef.target);
            animationStartZoom.current = camera.zoom;

            // Reset animation timer and set animating flag
            animationStartTime.current = 0;
            isAnimating.current = true;
            previousCloseUp.current = isCloseUp;
            previousTargetPosition.current = targetPosition;
            onAnimationStart?.();
        }

        // Handle camera animation
        if (isAnimating.current) {
            animationStartTime.current += delta;
            const progress = Math.min(
                animationStartTime.current / animationDuration,
                1,
            );

            if (progress < 1) {
                // Calculate eased progress using a cubic ease in-out function
                const easedProgress = easeInOutCubic(progress);

                // Interpolate camera position with easing from current position to target
                camera.position.lerpVectors(
                    animationStartPosition.current,
                    animationEndPosition.current,
                    easedProgress,
                );

                // Interpolate camera target with easing
                currentLookAt.current.lerpVectors(
                    animationStartTarget.current,
                    animationEndTarget.current,
                    easedProgress,
                );
                camera.lookAt(currentLookAt.current);

                // Interpolate zoom level
                camera.zoom =
                    animationStartZoom.current +
                    (animationEndZoom.current - animationStartZoom.current) *
                        easedProgress;

                // Look at the interpolated target
                camera.updateProjectionMatrix();

                // Update the controls target if available
                if (controlsRef) {
                    controlsRef.target.copy(currentLookAt.current);
                }
            } else {
                // Animation complete
                isAnimating.current = false;
                onAnimationComplete?.();

                // Ensure final position and orientation are correct
                camera.position.copy(animationEndPosition.current);
                camera.lookAt(animationEndTarget.current);

                // Update the controls target if available
                if (controlsRef && !isCloseUp) {
                    controlsRef.target.copy(animationEndTarget.current);
                }
            }
        }
    });

    return null;
}
