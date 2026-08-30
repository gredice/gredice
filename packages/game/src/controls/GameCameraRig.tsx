'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MathUtils, OrthographicCamera, Vector2, Vector3 } from 'three';
import { useCurrentGarden } from '../hooks/useCurrentGarden';
import { useSceneCurrentGarden } from '../hooks/useSceneCurrentGarden';
import { updateGameProfileMetadata } from '../scene/gameProfileMetadata';
import { sceneFrameRates, useSceneTimeInvalidation } from '../scene/SceneTime';
import { useGameState } from '../useGameState';
import {
    findRaisedBedByBlockId,
    getRaisedBedFootprintSegments,
} from '../utils/raisedBedBlocks';
import {
    applyCursorAnchoredZoom,
    createCursorAnchoredZoomScratch,
} from './cursorAnchoredZoom';
import {
    getDragEdgeAutopanDelta,
    hasDragEdgeAutopanDelta,
} from './dragEdgeAutopan';
import type {
    GameCameraFocusOptions,
    GameCameraRigApi,
    GameCameraSnapshot,
} from './GameCameraRigApi';
import { resolveGameCameraInitialView } from './gameCameraInitialView';

const closeupZoom = 300;
const animationDurationSeconds = 1;
const focusAnimationDurationSeconds = 0.65;
const focusStopDistance = 0.01;
const defaultMinZoom = 50;
const maxZoom = 500;
const cameraDragThresholdPx = 4;
const reducedMotionQuery = '(prefers-reduced-motion: reduce)';

const up = new Vector3(0, 1, 0);

const rotateKeys: Record<string, 'cw' | 'ccw'> = {
    KeyQ: 'cw',
    KeyW: 'ccw',
};

const panKeys: Record<string, [number, number]> = {
    ArrowUp: [0, 1],
    ArrowDown: [0, -1],
    ArrowLeft: [1, 0],
    ArrowRight: [-1, 0],
};

type CameraAnimation = {
    duration: number;
    elapsed: number;
    endPosition: Vector3;
    endTarget: Vector3;
    endZoom: number;
    startPosition: Vector3;
    startTarget: Vector3;
    startZoom: number;
    onComplete?: () => void;
};

type PointerState = {
    distance: number;
    midpoint: Vector2;
    pointerCount: number;
    startDistance: number;
    startMidpoint: Vector2;
};

type NormalCameraSnapshot = {
    position: Vector3;
    target: Vector3;
    zoom: number;
};

export type GameCameraCloseupFocus = {
    mode: 'preserve-angle';
    target?: Readonly<{
        x: number;
        y: number;
        z: number;
    }>;
    zoom?: number;
};

type CameraCloseupTarget = {
    key: string;
    mode: 'preserve-angle' | 'top-down';
    orientation?: 'vertical' | 'horizontal';
    target: Vector3;
    zoom: number;
};

function easeInOutCubic(value: number) {
    return value < 0.5
        ? 4 * value * value * value
        : 1 - (-2 * value + 2) ** 3 / 2;
}

function prefersReducedMotion() {
    return (
        typeof window !== 'undefined' &&
        typeof window.matchMedia === 'function' &&
        window.matchMedia(reducedMotionQuery).matches
    );
}

export function shouldGameCameraOwnPointerGesture(
    pointerCount: number,
    singlePointerPanEnabled: boolean,
) {
    return pointerCount >= 2 || (pointerCount === 1 && singlePointerPanEnabled);
}

export function shouldUseImmediateGameCameraTransition(
    duration: number,
    reducedMotion: boolean,
) {
    return duration <= 0 || reducedMotion;
}

function isEditableTarget(target: EventTarget | null) {
    if (!(target instanceof HTMLElement)) return false;
    if (target.isContentEditable) return true;
    const tag = target.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

function getWorldRotationAzimuth(worldRotation: number) {
    return worldRotation * (Math.PI / 2) + Math.PI / 4 + Math.PI;
}

function getRotatedCameraPosition({
    position,
    target,
    worldRotation,
}: {
    position: Vector3;
    target: Vector3;
    worldRotation: number;
}) {
    const offset = new Vector3().subVectors(position, target);
    const horizontalRadius = Math.hypot(offset.x, offset.z);
    const azimuth = getWorldRotationAzimuth(worldRotation);

    return new Vector3(
        target.x + Math.sin(azimuth) * horizontalRadius,
        target.y + offset.y,
        target.z + Math.cos(azimuth) * horizontalRadius,
    );
}

function getCloseupCameraPosition({
    cameraY,
    orientation,
    target,
}: {
    cameraY: number;
    orientation?: 'vertical' | 'horizontal';
    target: Vector3;
}) {
    const isHorizontalCloseup = orientation === 'horizontal';
    return new Vector3(
        isHorizontalCloseup ? target.x : target.x - 1,
        cameraY,
        isHorizontalCloseup ? target.z + 1 : target.z,
    );
}

export function getPreservedAngleCameraPosition({
    cameraPosition,
    cameraTarget,
    focusTarget,
}: {
    cameraPosition: Vector3;
    cameraTarget: Vector3;
    focusTarget: Vector3;
}) {
    return focusTarget
        .clone()
        .add(new Vector3().subVectors(cameraPosition, cameraTarget));
}

export function getScreenPositionAdjustedCameraTarget({
    camera,
    focusTarget,
    screenPosition,
    viewportHeight,
    viewportWidth,
    zoom,
}: {
    camera: OrthographicCamera;
    focusTarget: Vector3;
    screenPosition: Readonly<{ x: number; y: number }>;
    viewportHeight: number;
    viewportWidth: number;
    zoom: number;
}) {
    if (
        viewportWidth <= 0 ||
        viewportHeight <= 0 ||
        zoom <= 0 ||
        !Number.isFinite(viewportWidth) ||
        !Number.isFinite(viewportHeight) ||
        !Number.isFinite(zoom)
    ) {
        return focusTarget.clone();
    }

    const normalizedX = MathUtils.clamp(screenPosition.x, 0, 1);
    const normalizedY = MathUtils.clamp(screenPosition.y, 0, 1);
    const horizontalWorldUnitsPerPixel =
        (camera.right - camera.left) / zoom / viewportWidth;
    const verticalWorldUnitsPerPixel =
        (camera.top - camera.bottom) / zoom / viewportHeight;
    const horizontalPixelOffset = (normalizedX - 0.5) * viewportWidth;
    const verticalPixelOffset = (normalizedY - 0.5) * viewportHeight;
    camera.updateMatrixWorld();
    const cameraRight = new Vector3(1, 0, 0)
        .applyQuaternion(camera.quaternion)
        .normalize();
    const cameraUp = new Vector3(0, 1, 0)
        .applyQuaternion(camera.quaternion)
        .normalize();

    return focusTarget
        .clone()
        .addScaledVector(
            cameraRight,
            -horizontalPixelOffset * horizontalWorldUnitsPerPixel,
        )
        .addScaledVector(
            cameraUp,
            verticalPixelOffset * verticalWorldUnitsPerPixel,
        );
}

export function resolvePreservedAngleCloseupZoom(
    currentZoom: number,
    requestedZoom: number,
) {
    return Math.max(currentZoom, requestedZoom);
}

function getPointerDistance(left: Vector2, right: Vector2) {
    return Math.max(1, left.distanceTo(right));
}

function getPointerMidpoint(left: Vector2, right: Vector2) {
    return new Vector2((left.x + right.x) / 2, (left.y + right.y) / 2);
}

function toSnapshot({
    position,
    target,
    version,
    zoom,
}: {
    position: Vector3;
    target: Vector3;
    version: number;
    zoom: number;
}): GameCameraSnapshot {
    return {
        position: [position.x, position.y, position.z],
        target: [target.x, target.y, target.z],
        version,
        zoom,
    };
}

export function GameCameraRig({
    closeupFocus,
    controlsEnabled,
    gestureResetKey,
    initialPosition,
    initialSnapshot,
    initialTarget,
    initialViewKey,
    initialZoom,
    minZoom = defaultMinZoom,
    singlePointerPanEnabled = true,
}: {
    closeupFocus?: GameCameraCloseupFocus;
    controlsEnabled: boolean;
    gestureResetKey?: string | number | boolean | null;
    initialPosition?: Vector3;
    initialSnapshot?: Pick<GameCameraSnapshot, 'position' | 'target' | 'zoom'>;
    initialTarget?: Vector3;
    initialViewKey?: string | number | null;
    initialZoom?: number;
    minZoom?: number;
    /** Keeps pinch/pan available while another build tool owns one pointer. */
    singlePointerPanEnabled?: boolean;
}) {
    const { camera, gl, invalidate, size } = useThree();
    const isOrthographicCamera = camera instanceof OrthographicCamera;
    const setGameCamera = useGameState((state) => state.setGameCamera);
    const setGameCameraSnapshot = useGameState(
        (state) => state.setGameCameraSnapshot,
    );
    const setCloseupCameraActive = useGameState(
        (state) => state.setCloseupCameraActive,
    );
    const setCloseupCameraSettled = useGameState(
        (state) => state.setCloseupCameraSettled,
    );
    const [isAnimating, setIsAnimating] = useState(false);
    const [isKeyboardPanning, setIsKeyboardPanning] = useState(false);
    const isDragging = useGameState((state) => state.isDragging);
    const setIsDragging = useGameState((state) => state.setIsDragging);
    const worldRotation = useGameState((state) => state.worldRotation);
    const worldRotate = useGameState((state) => state.worldRotate);
    const view = useGameState((state) => state.view);
    const setView = useGameState((state) => state.setView);
    const closeupBlock = useGameState((state) => state.closeupBlock);
    const isBlockPlacementActive = useGameState(
        (state) =>
            Boolean(state.pickupBlock) || Boolean(state.hudPlacementDrag),
    );
    const { data: gardenData } = useCurrentGarden();
    const garden = useSceneCurrentGarden(gardenData);
    const resolvedMinZoom = MathUtils.clamp(minZoom, 1, maxZoom);
    useSceneTimeInvalidation(
        isAnimating || isDragging || isKeyboardPanning,
        sceneFrameRates.interactive,
    );

    const resolvedInitialView = useMemo(
        () =>
            resolveGameCameraInitialView({
                initialPosition,
                initialSnapshot,
                initialTarget,
                initialZoom,
            }),
        [initialPosition, initialSnapshot, initialTarget, initialZoom],
    );
    const targetRef = useRef(resolvedInitialView.target.clone());
    const animationRef = useRef<CameraAnimation | null>(null);
    const apiRef = useRef<GameCameraRigApi | null>(null);
    const cameraListenersRef = useRef(
        new Set<(snapshot: GameCameraSnapshot) => void>(),
    );
    const initializedRef = useRef(false);
    const lastWorldRotationRef = useRef(worldRotation);
    const previousViewRef = useRef(view);
    const activePointersRef = useRef(new Map<number, Vector2>());
    const pointerStateRef = useRef<PointerState | null>(null);
    const activePanDirectionRef = useRef<[number, number] | null>(null);
    const snapshotVersionRef = useRef(0);
    const snapshotDirtyRef = useRef(false);
    const initialViewKeyRef = useRef<string | number | null | undefined>(
        undefined,
    );
    const skipCloseupTransitionRef = useRef(false);
    const closeupTransitionKeyRef = useRef<string | null>(null);
    const normalCameraRef = useRef<NormalCameraSnapshot>({
        position: resolvedInitialView.position.clone(),
        target: resolvedInitialView.target.clone(),
        zoom: resolvedInitialView.zoom,
    });
    const scratchForwardRef = useRef(new Vector3());
    const scratchRightRef = useRef(new Vector3());
    const cursorAnchoredZoomScratch = useMemo(
        createCursorAnchoredZoomScratch,
        [],
    );

    const closeupTarget = useMemo<CameraCloseupTarget | null>(() => {
        if (!closeupBlock || !garden) {
            return null;
        }

        const getStackPositionByBlockId = (blockId: string) =>
            garden.stacks.find((stack) =>
                stack.blocks.some((block) => block.id === blockId),
            )?.position;

        const closeupBlockPosition = getStackPositionByBlockId(closeupBlock.id);
        if (!closeupBlockPosition) {
            return null;
        }

        if (closeupFocus) {
            const target = closeupFocus.target
                ? new Vector3(
                      closeupFocus.target.x,
                      closeupFocus.target.y,
                      closeupFocus.target.z,
                  )
                : closeupBlockPosition.clone();
            const zoom = closeupFocus.zoom ?? closeupZoom;
            return {
                key: `${closeupBlock.id}:preserve-angle:${target.x}:${target.y}:${target.z}:${zoom}`,
                mode: closeupFocus.mode,
                orientation: undefined,
                target,
                zoom,
            };
        }

        const raisedBed = findRaisedBedByBlockId(garden, closeupBlock.id);
        if (!raisedBed) {
            return {
                key: `${closeupBlock.id}:top-down:${closeupBlockPosition.x}:${closeupBlockPosition.y}:${closeupBlockPosition.z}:${closeupZoom}`,
                mode: 'top-down',
                orientation: undefined,
                target: closeupBlockPosition.clone(),
                zoom: closeupZoom,
            };
        }

        const segments = getRaisedBedFootprintSegments(closeupBlock.rotation);
        const target = segments.reduce(
            (center, segment) =>
                center.add(
                    new Vector3(
                        segment.offset.x / segments.length,
                        0,
                        segment.offset.z / segments.length,
                    ),
                ),
            closeupBlockPosition.clone(),
        );
        return {
            key: `${closeupBlock.id}:top-down:${raisedBed.orientation ?? 'vertical'}:${target.x}:${target.y}:${target.z}:${closeupZoom}`,
            mode: 'top-down',
            orientation: raisedBed.orientation,
            target,
            zoom: closeupZoom,
        };
    }, [closeupBlock, closeupFocus, garden]);

    const controlsDisabled =
        !controlsEnabled ||
        view === 'closeup' ||
        isAnimating ||
        isBlockPlacementActive ||
        !isOrthographicCamera;

    const flushSnapshot = useCallback(() => {
        if (!snapshotDirtyRef.current || !isOrthographicCamera) {
            return;
        }

        snapshotDirtyRef.current = false;
        snapshotVersionRef.current += 1;
        const snapshot = toSnapshot({
            position: camera.position,
            target: targetRef.current,
            version: snapshotVersionRef.current,
            zoom: camera.zoom,
        });
        setGameCameraSnapshot(snapshot);
        for (const listener of cameraListenersRef.current) {
            listener(snapshot);
        }
    }, [camera, isOrthographicCamera, setGameCameraSnapshot]);

    const publishSnapshot = useCallback(() => {
        if (!isOrthographicCamera) {
            return;
        }

        snapshotDirtyRef.current = true;
    }, [isOrthographicCamera]);

    const applyCamera = useCallback(() => {
        if (!isOrthographicCamera) {
            return;
        }

        camera.lookAt(targetRef.current);
        camera.updateProjectionMatrix();
        camera.updateMatrixWorld();
        publishSnapshot();
        invalidate();
    }, [camera, invalidate, isOrthographicCamera, publishSnapshot]);

    const saveNormalCamera = useCallback(() => {
        if (!isOrthographicCamera || view !== 'normal') {
            return;
        }

        normalCameraRef.current = {
            position: camera.position.clone(),
            target: targetRef.current.clone(),
            zoom: camera.zoom,
        };
    }, [camera, isOrthographicCamera, view]);

    const setCameraZoom = useCallback(
        (zoom: number) => {
            if (!isOrthographicCamera) {
                return;
            }

            camera.zoom = MathUtils.clamp(zoom, resolvedMinZoom, maxZoom);
            applyCamera();
            saveNormalCamera();
        },
        [
            applyCamera,
            camera,
            isOrthographicCamera,
            resolvedMinZoom,
            saveNormalCamera,
        ],
    );

    const panByWorldVector = useCallback(
        (offset: Vector3) => {
            if (!isOrthographicCamera) {
                return;
            }

            camera.position.add(offset);
            targetRef.current.add(offset);
            applyCamera();
            saveNormalCamera();
        },
        [applyCamera, camera, isOrthographicCamera, saveNormalCamera],
    );

    const getWorldUnitsPerPixel = useCallback(() => {
        if (!isOrthographicCamera) {
            return 0;
        }

        return (
            (camera.top - camera.bottom) /
            camera.zoom /
            Math.max(1, gl.domElement.clientHeight || size.height)
        );
    }, [camera, gl.domElement, isOrthographicCamera, size.height]);

    const panByScreenPixels = useCallback(
        (deltaX: number, deltaY: number) => {
            if (!isOrthographicCamera) {
                return;
            }

            const worldUnitsPerPixel = getWorldUnitsPerPixel();
            if (worldUnitsPerPixel <= 0) {
                return;
            }

            camera.getWorldDirection(scratchForwardRef.current);
            scratchForwardRef.current.projectOnPlane(up).normalize();
            scratchRightRef.current
                .set(1, 0, 0)
                .applyQuaternion(camera.quaternion)
                .projectOnPlane(up)
                .normalize();

            const offset = scratchRightRef.current
                .clone()
                .multiplyScalar(-deltaX * worldUnitsPerPixel)
                .add(
                    scratchForwardRef.current
                        .clone()
                        .multiplyScalar(deltaY * worldUnitsPerPixel),
                );
            panByWorldVector(offset);
        },
        [camera, getWorldUnitsPerPixel, isOrthographicCamera, panByWorldVector],
    );

    const startAnimation = useCallback(
        ({
            duration,
            endPosition,
            endTarget,
            endZoom,
            onComplete,
        }: {
            duration: number;
            endPosition: Vector3;
            endTarget: Vector3;
            endZoom: number;
            onComplete?: () => void;
        }) => {
            if (!isOrthographicCamera) {
                return;
            }

            if (
                shouldUseImmediateGameCameraTransition(
                    duration,
                    prefersReducedMotion(),
                )
            ) {
                animationRef.current = null;
                setIsAnimating(false);
                camera.position.copy(endPosition);
                targetRef.current.copy(endTarget);
                camera.zoom = MathUtils.clamp(
                    endZoom,
                    resolvedMinZoom,
                    maxZoom,
                );
                applyCamera();
                onComplete?.();
                return;
            }

            animationRef.current = {
                duration,
                elapsed: 0,
                endPosition: endPosition.clone(),
                endTarget: endTarget.clone(),
                endZoom: MathUtils.clamp(endZoom, resolvedMinZoom, maxZoom),
                startPosition: camera.position.clone(),
                startTarget: targetRef.current.clone(),
                startZoom: camera.zoom,
                onComplete,
            };
            setIsAnimating(true);
        },
        [applyCamera, camera, isOrthographicCamera, resolvedMinZoom],
    );

    const focusOnPosition = useCallback(
        (position: Vector3, options?: GameCameraFocusOptions) => {
            if (!isOrthographicCamera) {
                return;
            }

            const cameraOffset = new Vector3().subVectors(
                camera.position,
                targetRef.current,
            );
            const endZoom = options?.zoom ?? camera.zoom;
            const canvasBounds = gl.domElement.getBoundingClientRect();
            const endTarget = options?.screenPosition
                ? getScreenPositionAdjustedCameraTarget({
                      camera,
                      focusTarget: position,
                      screenPosition: options.screenPosition,
                      viewportHeight: canvasBounds.height,
                      viewportWidth: canvasBounds.width,
                      zoom: endZoom,
                  })
                : position.clone();
            const endPosition = endTarget.clone().add(cameraOffset);

            startAnimation({
                duration: options?.immediate
                    ? 0
                    : focusAnimationDurationSeconds,
                endPosition,
                endTarget,
                endZoom,
                onComplete: options?.onComplete,
            });
        },
        [camera, gl.domElement, isOrthographicCamera, startAnimation],
    );

    const restoreSnapshot = useCallback(
        (
            snapshot: Pick<GameCameraSnapshot, 'position' | 'target' | 'zoom'>,
            options?: GameCameraFocusOptions,
        ) => {
            startAnimation({
                duration: options?.immediate
                    ? 0
                    : focusAnimationDurationSeconds,
                endPosition: new Vector3(...snapshot.position),
                endTarget: new Vector3(...snapshot.target),
                endZoom: snapshot.zoom,
                onComplete: options?.onComplete,
            });
        },
        [startAnimation],
    );

    if (!apiRef.current) {
        apiRef.current = {
            focus: (position, options) => focusOnPosition(position, options),
            getCamera: () => camera,
            getDomElement: () => gl.domElement,
            getSnapshot: () =>
                toSnapshot({
                    position: camera.position,
                    target: targetRef.current,
                    version: snapshotVersionRef.current,
                    zoom: isOrthographicCamera ? camera.zoom : 1,
                }),
            panByDragEdge: (pointer, frameDeltaSeconds) => {
                if (!isOrthographicCamera) {
                    return false;
                }

                const rect = gl.domElement.getBoundingClientRect();
                const screenDelta = getDragEdgeAutopanDelta({
                    frameDeltaSeconds,
                    pointer,
                    viewport: rect,
                });

                if (!hasDragEdgeAutopanDelta(screenDelta)) {
                    return false;
                }

                panByScreenPixels(screenDelta.x, screenDelta.y);
                return true;
            },
            projectToScreen: (position) => {
                const rect = gl.domElement.getBoundingClientRect();
                if (rect.width <= 0 || rect.height <= 0) {
                    return null;
                }

                const projected = position.clone().project(camera);
                return {
                    x: rect.left + ((projected.x + 1) / 2) * rect.width,
                    y: rect.top + ((-projected.y + 1) / 2) * rect.height,
                };
            },
            restore: (snapshot, options) => restoreSnapshot(snapshot, options),
            subscribe: (listener) => {
                cameraListenersRef.current.add(listener);
                listener(
                    apiRef.current?.getSnapshot() ?? {
                        position: [
                            camera.position.x,
                            camera.position.y,
                            camera.position.z,
                        ],
                        target: [
                            targetRef.current.x,
                            targetRef.current.y,
                            targetRef.current.z,
                        ],
                        version: snapshotVersionRef.current,
                        zoom: isOrthographicCamera ? camera.zoom : 1,
                    },
                );
                return () => {
                    cameraListenersRef.current.delete(listener);
                };
            },
        };
    }
    apiRef.current.focus = (position, options) =>
        focusOnPosition(position, options);
    apiRef.current.restore = (snapshot, options) =>
        restoreSnapshot(snapshot, options);

    useEffect(() => {
        if (!isOrthographicCamera) {
            return;
        }

        const shouldApplyInitialView =
            !initializedRef.current ||
            initialViewKeyRef.current !== initialViewKey;
        if (shouldApplyInitialView) {
            const initialViewChanged = initializedRef.current;
            animationRef.current = null;
            closeupTransitionKeyRef.current = null;
            setIsAnimating(false);
            camera.position.copy(resolvedInitialView.position);
            camera.zoom = MathUtils.clamp(
                resolvedInitialView.zoom,
                resolvedMinZoom,
                maxZoom,
            );
            targetRef.current.copy(resolvedInitialView.target);
            if (initialViewChanged) {
                skipCloseupTransitionRef.current = true;
                previousViewRef.current = 'normal';
                setCloseupCameraActive(false);
                setCloseupCameraSettled(false);
                setView({ view: 'normal' });
            }
            normalCameraRef.current = {
                position: camera.position.clone(),
                target: targetRef.current.clone(),
                zoom: camera.zoom,
            };
            initializedRef.current = true;
            initialViewKeyRef.current = initialViewKey;
            applyCamera();
            flushSnapshot();
        }
        setGameCamera(apiRef.current);
        return () => {
            setGameCamera(null);
        };
    }, [
        applyCamera,
        camera,
        flushSnapshot,
        initialViewKey,
        isOrthographicCamera,
        resolvedInitialView,
        resolvedMinZoom,
        setCloseupCameraActive,
        setCloseupCameraSettled,
        setGameCamera,
        setView,
    ]);

    // gestureResetKey intentionally participates only in lifecycle identity:
    // entering or leaving an exclusive mode must run this effect's cleanup.
    // biome-ignore lint/correctness/useExhaustiveDependencies: lifecycle reset key intentionally has no effect-body read.
    useEffect(() => {
        const element = gl.domElement;
        const previousTouchAction = element.style.touchAction;
        element.style.touchAction = 'none';
        let cameraDragging = false;

        const setCameraDragging = (dragging: boolean) => {
            if (cameraDragging === dragging) {
                return;
            }

            cameraDragging = dragging;
            setIsDragging(dragging);
        };

        const publishActivePointerCount = () =>
            updateGameProfileMetadata({
                gardenStructureCameraActivePointerCount:
                    activePointersRef.current.size,
            });

        const clearPointers = () => {
            for (const pointerId of activePointersRef.current.keys()) {
                if (element.hasPointerCapture(pointerId)) {
                    element.releasePointerCapture(pointerId);
                }
            }
            activePointersRef.current.clear();
            pointerStateRef.current = null;
            setCameraDragging(false);
            publishActivePointerCount();
        };

        const updatePointerState = () => {
            const pointers = Array.from(activePointersRef.current.values());
            if (pointers.length >= 2) {
                const distance = getPointerDistance(pointers[0], pointers[1]);
                const midpoint = getPointerMidpoint(pointers[0], pointers[1]);
                pointerStateRef.current = {
                    distance,
                    midpoint,
                    pointerCount: 2,
                    startDistance: distance,
                    startMidpoint: midpoint.clone(),
                };
                return;
            }

            if (pointers.length === 1) {
                pointerStateRef.current = {
                    distance: 0,
                    midpoint: pointers[0].clone(),
                    pointerCount: 1,
                    startDistance: 0,
                    startMidpoint: pointers[0].clone(),
                };
                return;
            }

            pointerStateRef.current = null;
        };

        const handlePointerDown = (event: PointerEvent) => {
            if (controlsDisabled || event.button !== 0) {
                return;
            }

            activePointersRef.current.set(
                event.pointerId,
                new Vector2(event.clientX, event.clientY),
            );
            publishActivePointerCount();
            updatePointerState();
            if (
                shouldGameCameraOwnPointerGesture(
                    activePointersRef.current.size,
                    singlePointerPanEnabled,
                )
            ) {
                for (const pointerId of activePointersRef.current.keys()) {
                    if (!element.hasPointerCapture(pointerId)) {
                        element.setPointerCapture(pointerId);
                    }
                }
            }
            if (activePointersRef.current.size >= 2) {
                setCameraDragging(true);
            }
        };

        const handlePointerMove = (event: PointerEvent) => {
            const previousPointer = activePointersRef.current.get(
                event.pointerId,
            );
            if (!previousPointer || controlsDisabled) {
                return;
            }

            activePointersRef.current.set(
                event.pointerId,
                new Vector2(event.clientX, event.clientY),
            );

            const pointers = Array.from(activePointersRef.current.values());
            const pointerState = pointerStateRef.current;
            if (!pointerState) {
                updatePointerState();
                return;
            }

            if (pointers.length >= 2 && pointerState.pointerCount >= 2) {
                const nextDistance = getPointerDistance(
                    pointers[0],
                    pointers[1],
                );
                const nextMidpoint = getPointerMidpoint(
                    pointers[0],
                    pointers[1],
                );
                panByScreenPixels(
                    nextMidpoint.x - pointerState.midpoint.x,
                    nextMidpoint.y - pointerState.midpoint.y,
                );
                setCameraZoom(
                    camera.zoom * (nextDistance / pointerState.distance),
                );
                pointerStateRef.current = {
                    distance: nextDistance,
                    midpoint: nextMidpoint,
                    pointerCount: 2,
                    startDistance: pointerState.startDistance,
                    startMidpoint: pointerState.startMidpoint,
                };
                if (
                    Math.abs(nextDistance - pointerState.startDistance) >
                        cameraDragThresholdPx ||
                    nextMidpoint.distanceTo(pointerState.startMidpoint) >
                        cameraDragThresholdPx
                ) {
                    setCameraDragging(true);
                }
                return;
            }

            if (
                shouldGameCameraOwnPointerGesture(
                    pointers.length,
                    singlePointerPanEnabled,
                ) &&
                pointers.length === 1 &&
                pointerState.pointerCount === 1
            ) {
                const nextMidpoint = new Vector2(event.clientX, event.clientY);
                panByScreenPixels(
                    nextMidpoint.x - pointerState.midpoint.x,
                    nextMidpoint.y - pointerState.midpoint.y,
                );
                pointerStateRef.current = {
                    distance: 0,
                    midpoint: nextMidpoint,
                    pointerCount: 1,
                    startDistance: pointerState.startDistance,
                    startMidpoint: pointerState.startMidpoint,
                };
                if (
                    nextMidpoint.distanceTo(pointerState.startMidpoint) >
                    cameraDragThresholdPx
                ) {
                    setCameraDragging(true);
                }
                return;
            }

            updatePointerState();
        };

        const handlePointerUp = (event: PointerEvent) => {
            const cameraOwnedGesture = shouldGameCameraOwnPointerGesture(
                activePointersRef.current.size,
                singlePointerPanEnabled,
            );
            activePointersRef.current.delete(event.pointerId);
            publishActivePointerCount();
            if (
                cameraOwnedGesture &&
                element.hasPointerCapture(event.pointerId)
            ) {
                element.releasePointerCapture(event.pointerId);
            }
            updatePointerState();
            if (activePointersRef.current.size === 0) {
                setCameraDragging(false);
            }
        };

        const handleWheel = (event: WheelEvent) => {
            if (controlsDisabled) {
                return;
            }

            event.preventDefault();
            const nextZoom = MathUtils.clamp(
                camera.zoom * Math.exp(-event.deltaY * 0.001),
                resolvedMinZoom,
                maxZoom,
            );
            const changed = applyCursorAnchoredZoom({
                camera,
                cursor: event,
                nextZoom,
                scratch: cursorAnchoredZoomScratch,
                target: targetRef.current,
                viewport: element.getBoundingClientRect(),
            });
            if (changed) {
                applyCamera();
                saveNormalCamera();
            }
        };

        element.addEventListener('pointerdown', handlePointerDown);
        element.addEventListener('pointermove', handlePointerMove);
        element.addEventListener('pointerup', handlePointerUp);
        element.addEventListener('pointercancel', handlePointerUp);
        element.addEventListener('lostpointercapture', handlePointerUp);
        element.addEventListener('wheel', handleWheel, { passive: false });
        window.addEventListener('blur', clearPointers);

        return () => {
            element.style.touchAction = previousTouchAction;
            element.removeEventListener('pointerdown', handlePointerDown);
            element.removeEventListener('pointermove', handlePointerMove);
            element.removeEventListener('pointerup', handlePointerUp);
            element.removeEventListener('pointercancel', handlePointerUp);
            element.removeEventListener('lostpointercapture', handlePointerUp);
            element.removeEventListener('wheel', handleWheel);
            window.removeEventListener('blur', clearPointers);
            clearPointers();
        };
    }, [
        applyCamera,
        camera,
        controlsDisabled,
        cursorAnchoredZoomScratch,
        gl.domElement,
        gestureResetKey,
        panByScreenPixels,
        resolvedMinZoom,
        saveNormalCamera,
        setCameraZoom,
        setIsDragging,
        singlePointerPanEnabled,
    ]);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (
                controlsDisabled ||
                event.shiftKey ||
                event.altKey ||
                event.ctrlKey ||
                event.metaKey ||
                isEditableTarget(event.target)
            ) {
                return;
            }

            const rotateValue = rotateKeys[event.code];
            if (rotateValue) {
                worldRotate(rotateValue);
                return;
            }

            const panValue = panKeys[event.code];
            if (panValue) {
                activePanDirectionRef.current = panValue;
                setIsKeyboardPanning(true);
            }
        };

        const handleKeyUp = (event: KeyboardEvent) => {
            if (panKeys[event.code]) {
                activePanDirectionRef.current = null;
                setIsKeyboardPanning(false);
            }
        };

        const clearKeyboardPan = () => {
            activePanDirectionRef.current = null;
            setIsKeyboardPanning(false);
        };

        const handleVisibilityChange = () => {
            if (document.hidden) {
                clearKeyboardPan();
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        document.addEventListener('keyup', handleKeyUp);
        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('blur', clearKeyboardPan);
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            document.removeEventListener('keyup', handleKeyUp);
            document.removeEventListener(
                'visibilitychange',
                handleVisibilityChange,
            );
            window.removeEventListener('blur', clearKeyboardPan);
            clearKeyboardPan();
        };
    }, [controlsDisabled, worldRotate]);

    useEffect(() => {
        if (!initializedRef.current || !isOrthographicCamera) {
            return;
        }

        if (skipCloseupTransitionRef.current) {
            skipCloseupTransitionRef.current = false;
            previousViewRef.current = 'normal';
            return;
        }

        const previousView = previousViewRef.current;

        if (view === 'closeup' && closeupTarget) {
            if (
                previousView === 'closeup' &&
                closeupTransitionKeyRef.current === closeupTarget.key
            ) {
                return;
            }

            setCloseupCameraActive(true);
            setCloseupCameraSettled(false);
            if (previousView !== 'closeup') {
                normalCameraRef.current = {
                    position: camera.position.clone(),
                    target: targetRef.current.clone(),
                    zoom: camera.zoom,
                };
            }

            const endPosition =
                closeupTarget.mode === 'preserve-angle'
                    ? getPreservedAngleCameraPosition({
                          cameraPosition: camera.position,
                          cameraTarget: targetRef.current,
                          focusTarget: closeupTarget.target,
                      })
                    : getCloseupCameraPosition({
                          cameraY: camera.position.y,
                          orientation: closeupTarget.orientation,
                          target: closeupTarget.target,
                      });
            const endZoom =
                closeupTarget.mode === 'preserve-angle'
                    ? resolvePreservedAngleCloseupZoom(
                          camera.zoom,
                          closeupTarget.zoom,
                      )
                    : closeupTarget.zoom;

            closeupTransitionKeyRef.current = closeupTarget.key;
            startAnimation({
                duration: animationDurationSeconds,
                endPosition,
                endTarget: closeupTarget.target,
                endZoom,
                onComplete: () => setCloseupCameraSettled(true),
            });
            previousViewRef.current = view;
            return;
        }

        if (view === 'normal' && previousView === 'closeup') {
            closeupTransitionKeyRef.current = null;
            startAnimation({
                duration: animationDurationSeconds,
                endPosition: normalCameraRef.current.position,
                endTarget: normalCameraRef.current.target,
                endZoom: normalCameraRef.current.zoom,
                onComplete: () => {
                    setCloseupCameraActive(false);
                    setCloseupCameraSettled(false);
                },
            });
        }
        previousViewRef.current = view;
    }, [
        camera,
        closeupTarget,
        isOrthographicCamera,
        setCloseupCameraActive,
        setCloseupCameraSettled,
        startAnimation,
        view,
    ]);

    useEffect(() => {
        return () => {
            setCloseupCameraActive(false);
            setCloseupCameraSettled(false);
        };
    }, [setCloseupCameraActive, setCloseupCameraSettled]);

    useFrame((_, delta) => {
        if (!isOrthographicCamera) {
            return;
        }

        if (lastWorldRotationRef.current !== worldRotation) {
            lastWorldRotationRef.current = worldRotation;
            if (view === 'normal') {
                camera.position.copy(
                    getRotatedCameraPosition({
                        position: camera.position,
                        target: targetRef.current,
                        worldRotation,
                    }),
                );
                applyCamera();
                saveNormalCamera();
            }
        }

        if (animationRef.current) {
            const animation = animationRef.current;
            animation.elapsed += delta;
            const progress =
                animation.duration <= 0
                    ? 1
                    : Math.min(animation.elapsed / animation.duration, 1);
            const easedProgress = easeInOutCubic(progress);

            camera.position.lerpVectors(
                animation.startPosition,
                animation.endPosition,
                easedProgress,
            );
            targetRef.current.lerpVectors(
                animation.startTarget,
                animation.endTarget,
                easedProgress,
            );
            camera.zoom =
                animation.startZoom +
                (animation.endZoom - animation.startZoom) * easedProgress;
            applyCamera();

            if (
                progress >= 1 ||
                (camera.position.distanceTo(animation.endPosition) <=
                    focusStopDistance &&
                    targetRef.current.distanceTo(animation.endTarget) <=
                        focusStopDistance)
            ) {
                camera.position.copy(animation.endPosition);
                targetRef.current.copy(animation.endTarget);
                camera.zoom = animation.endZoom;
                animationRef.current = null;
                setIsAnimating(false);
                applyCamera();
                saveNormalCamera();
                animation.onComplete?.();
            }
            flushSnapshot();
            return;
        }

        const activePanDirection = activePanDirectionRef.current;
        if (!controlsDisabled && activePanDirection) {
            camera.getWorldDirection(scratchForwardRef.current);
            const offset = scratchForwardRef.current
                .projectOnPlane(up)
                .applyAxisAngle(
                    up,
                    Math.atan2(activePanDirection[0], activePanDirection[1]),
                )
                .normalize()
                .multiplyScalar(0.2);
            panByWorldVector(offset);
        }

        flushSnapshot();
    });

    return null;
}
