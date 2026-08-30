'use client';

import { animated, useSpring } from '@react-spring/three';
import { Shadow } from '@react-three/drei';
import { type ThreeEvent, useThree } from '@react-three/fiber';
import {
    type ReactNode,
    Suspense,
    useCallback,
    useContext,
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import { Plane, Raycaster, Vector2, Vector3 } from 'three';
import { useGameAnalytics } from '../analytics/GameAnalyticsContext';
import {
    type ActiveDragPreviewTarget,
    activeDragPreviewTargetMatches,
    createActiveDragPreviewTarget,
    findActiveDragPreviewTargetOffset,
} from '../dragPreviewIdentity';
import { useBlockData } from '../hooks/useBlockData';
import { useBlockDelete } from '../hooks/useBlockDelete';
import { useBlockMove } from '../hooks/useBlockMove';
import { useBlockRecycle } from '../hooks/useBlockRecycle';
import { useBlockRotate } from '../hooks/useBlockRotate';
import {
    type CurrentGarden,
    useCurrentGardenCache,
} from '../hooks/useCurrentGarden';
import { useGardenBoxStoreBlock } from '../hooks/useGardenBoxStoreBlock';
import { isPointOverItemsHudDropTarget } from '../itemsHudDropTarget';
import {
    resolveBlockParticleType,
    useParticles,
} from '../particles/ParticleSystem';
import { updateGameProfileMetadata } from '../scene/gameProfileMetadata';
import {
    type ActiveDragPreview,
    GameStateContext,
    useGameState,
} from '../useGameState';
import { useSetRaisedBedCloseupParam } from '../useRaisedBedCloseup';
import { useGiftBoxParam } from '../useUrlState';
import { getBlockDataByName } from '../utils/getStackHeight';
import {
    triggerPickHaptic,
    triggerPlaceHaptic,
    triggerSelectionHaptic,
} from '../utils/haptics';
import { findRaisedBedByBlockId } from '../utils/raisedBedBlocks';
import {
    type BlockInteractionTarget,
    createBlockInteractionTargetKey,
} from './BlockInteractionRegistry';
import type { BlockInteractionLayerTarget } from './BlockInteractionResolver';
import {
    areBlockInteractionsSuppressed,
    suppressBlockInteractions,
} from './blockInteractionSuppression';
import { canRotatePlacedBlock } from './blockRotation';
import {
    getInstancedInteractionMountProfileMetadata,
    getPickupPointerMoveCancelDistance,
    type InstancedInteractionFirstTap,
    resolveInstancedInteractionTargetReconciliation,
    resolveInstancedRotationTap,
} from './instancedBlockInteractionCore';
import { RecycleIndicator } from './PickableGroup';
import {
    createPickupPlacementPreviewResolver,
    type MovingSegment,
    type PickupPlacementPreviewResolver,
    type ResolvedPlacementPreview,
} from './PickupPlacementResolver';
import { resolvePickupHudDropAction } from './pickupRemovalDropAction';
import {
    createPickupSelectionMoveRequests,
    createPickupSelectionMovingSegments,
} from './pickupSelection';
import { useDeferredSingleClickByTarget } from './useDeferredSingleClick';
import { useHoveredBlockStore } from './useHoveredBlockStore';

const groundPlane = new Plane(new Vector3(0, 1, 0), 0);
const pickupHintDelayMs = 120;
const pickupHoldDelayMs = 320;
const pickupHintLift = 0.04;
const pickupLift = 0.1;
const suppressClickAfterDragMs = 450;
const placementSnapSearchRadius = 5;
const animalPickupDisturbanceRadius = 1.8;
const rotateDragThreshold = 0.1;
const doubleTapThresholdMs = 320;

type PickupAnchorOffset = {
    x: number;
    y: number;
    z: number;
};

type PointerSession = {
    target: BlockInteractionLayerTarget;
    activePreviewTarget: ActiveDragPreviewTarget;
    pointerId: number;
    pointerType: string;
    startClientX: number;
    startClientY: number;
    lastClientX: number;
    lastClientY: number;
    pickupClientX: number | null;
    pickupClientY: number | null;
    pickupAnchorOffset: PickupAnchorOffset;
    hasDraggedAfterPickup: boolean;
    activated: boolean;
    cancelled: boolean;
    hintVisible: boolean;
    hintTimer: number | null;
    holdTimer: number | null;
    dragAutopanFrame: number | null;
    dragAutopanPreviousTime: number | null;
    latestPreview: ResolvedPlacementPreview | null;
};

type RotationPointerSession = {
    point: Vector3;
    targetKey: string;
};

export type InstancedBlockInteractionControllerApi = {
    onClick: (
        target: BlockInteractionLayerTarget,
        event: ThreeEvent<MouseEvent>,
    ) => void;
    onPickupPointerEnter: (
        target: BlockInteractionLayerTarget,
        event: ThreeEvent<PointerEvent>,
    ) => void;
    onPointerDown: (
        target: BlockInteractionLayerTarget,
        event: ThreeEvent<PointerEvent>,
    ) => void;
    onPointerEnter: (
        target: BlockInteractionLayerTarget,
        event: ThreeEvent<PointerEvent>,
    ) => void;
    onPointerLeave: (
        target: BlockInteractionLayerTarget | null,
        event: ThreeEvent<PointerEvent>,
    ) => void;
    onPointerUp: (
        target: BlockInteractionLayerTarget,
        event: ThreeEvent<PointerEvent>,
    ) => void;
    onSelectClick: (
        target: BlockInteractionLayerTarget,
        event: ThreeEvent<MouseEvent>,
    ) => void;
};

function pointerDistance(session: PointerSession, x: number, y: number) {
    return Math.hypot(x - session.startClientX, y - session.startClientY);
}

function clearPointerSessionTimers(session: PointerSession) {
    if (session.hintTimer) {
        window.clearTimeout(session.hintTimer);
        session.hintTimer = null;
    }
    if (session.holdTimer) {
        window.clearTimeout(session.holdTimer);
        session.holdTimer = null;
    }
}

function activeDragPreviewAffectsTarget(
    preview: ActiveDragPreview | null | undefined,
    target: ActiveDragPreviewTarget,
) {
    return (
        activeDragPreviewTargetMatches(preview?.source, target) ||
        Boolean(findActiveDragPreviewTargetOffset(preview?.targets, target))
    );
}

const placementPreviewEpsilon = 0.0001;

function placementPreviewNumbersEqual(left: number, right: number) {
    return Math.abs(left - right) <= placementPreviewEpsilon;
}

function placementPreviewTargetsEqual(
    left: ResolvedPlacementPreview['targetOffsets'],
    right: ResolvedPlacementPreview['targetOffsets'],
) {
    if (left.length !== right.length) {
        return false;
    }

    return left.every((leftTarget, index) => {
        const rightTarget = right[index];
        return (
            Boolean(rightTarget) &&
            activeDragPreviewTargetMatches(leftTarget, rightTarget) &&
            placementPreviewNumbersEqual(
                leftTarget.hoverHeight,
                rightTarget?.hoverHeight ?? Number.NaN,
            )
        );
    });
}

function resolvedPlacementPreviewsEqual(
    left: ResolvedPlacementPreview | null | undefined,
    right: ResolvedPlacementPreview | null | undefined,
) {
    if (left === right) {
        return true;
    }
    if (!left || !right) {
        return false;
    }

    return (
        placementPreviewNumbersEqual(left.relative.x, right.relative.x) &&
        placementPreviewNumbersEqual(left.relative.z, right.relative.z) &&
        placementPreviewNumbersEqual(
            left.previewHoverHeight,
            right.previewHoverHeight,
        ) &&
        left.hoveredGardenBoxBlockId === right.hoveredGardenBoxBlockId &&
        left.canStoreInGardenBox === right.canStoreInGardenBox &&
        left.nextIsOverRecycler === right.nextIsOverRecycler &&
        left.nextIsBlocked === right.nextIsBlocked &&
        placementPreviewTargetsEqual(left.targetOffsets, right.targetOffsets)
    );
}

function createPreviewTarget(target: BlockInteractionTarget) {
    return createActiveDragPreviewTarget({
        blockId: target.block.id,
        blockIndex: target.blockIndex,
        stackPosition: {
            x: target.stack.position.x,
            z: target.stack.position.z,
        },
    });
}

function isSelectableTarget(target: BlockInteractionLayerTarget) {
    return (
        target.block.name === 'GardenBox' ||
        target.block.name.startsWith('GiftBox_') ||
        target.block.name === 'Raised_Bed'
    );
}

function targetKeyFromPreviewTarget(target: ActiveDragPreviewTarget) {
    return createBlockInteractionTargetKey({
        blockId: target.blockId,
        blockIndex: target.blockIndex,
        stackPosition: target.stackPosition,
    });
}

export function InstancedBlockInteractionController({
    children,
    targets,
}: {
    children: (controller: InstancedBlockInteractionControllerApi) => ReactNode;
    targets: BlockInteractionLayerTarget[];
}) {
    const [dragSprings, dragSpringsApi] = useSpring(() => ({
        from: { internalPosition: [0, 0, 0], scale: 1 },
        config: {
            mass: 0.1,
            tension: 200,
            friction: 10,
        },
    }));
    const { spawn } = useParticles();
    const getCurrentGarden = useCurrentGardenCache();
    const { data: blocksData } = useBlockData();
    const gameStateStore = useContext(GameStateContext);
    const camera = useThree((state) => state.camera);
    const gl = useThree((state) => state.gl);
    const { domElement } = gl;
    const dragState = useRef({
        pt: new Vector3(),
        dest: new Vector3(),
        relative: new Vector3(),
        projected: new Vector3(),
    });
    const raycaster = useRef(new Raycaster());
    const pointerVector = useRef(new Vector2());

    const effectsAudioMixer = useGameState((state) => state.audio.effects);
    const gameCamera = useGameState((state) => state.gameCamera);
    const setIsDragging = useGameState((state) => state.setIsDragging);
    const pickupSound = effectsAudioMixer.useSoundEffect(
        'https://cdn.gredice.com/sounds/effects/Pick Grass 01.mp3',
    );
    const dropSound = effectsAudioMixer.useSoundEffect(
        'https://cdn.gredice.com/sounds/effects/Drop Grass 01.mp3',
    );
    const swipeSound = effectsAudioMixer.useSoundEffect(
        'https://cdn.gredice.com/sounds/effects/Swipe Generic 01.mp3',
    );

    const setPickupBlock = useGameState((state) => state.setPickupBlock);
    const pickupSelectionTargets = useGameState(
        (state) => state.pickupSelectionTargets,
    );
    const setPickupSelectionTargets = useGameState(
        (state) => state.setPickupSelectionTargets,
    );
    const clearPickupSelectionTargets = useGameState(
        (state) => state.clearPickupSelectionTargets,
    );
    const disturbAnimals = useGameState((state) => state.disturbAnimals);
    const activeDragPreview = useGameState((state) => state.activeDragPreview);
    const setActiveDragPreview = useGameState(
        (state) => state.setActiveDragPreview,
    );
    const setStationaryPickupOutlineTarget = useGameState(
        (state) => state.setStationaryPickupOutlineTarget,
    );
    const setItemsHudDropTargetActive = useGameState(
        (state) => state.setItemsHudDropTargetActive,
    );
    const setOpenGardenBoxBlockId = useGameState(
        (state) => state.setOpenGardenBoxBlockId,
    );
    const localSandboxStorageKey = useGameState(
        (state) => state.localSandboxStorageKey,
    );

    const [isBlocked, setIsBlocked] = useState(false);
    const [isOverRecycler, setIsOverRecycler] = useState(false);
    const [pickupOutlineVisible, setPickupOutlineVisible] = useState(false);
    const [visualTarget, setVisualTarget] =
        useState<BlockInteractionLayerTarget | null>(null);
    const deleteBlocks = useBlockDelete();
    const moveBlock = useBlockMove();
    const recycleBlock = useBlockRecycle();
    const storeBlockInGardenBox = useGardenBoxStoreBlock();
    const blockRotate = useBlockRotate();
    const { track } = useGameAnalytics();
    const { mutate: setRaisedBedCloseupParam } = useSetRaisedBedCloseupParam();
    const [, setGiftBoxParam] = useGiftBoxParam();

    const pointerSession = useRef<PointerSession | null>(null);
    const pointerSessionCleanup = useRef<(() => void) | null>(null);
    const rotationPointerSession = useRef<RotationPointerSession | null>(null);
    const firstTap = useRef<InstancedInteractionFirstTap | null>(null);
    const hoveredTarget = useRef<BlockInteractionLayerTarget | null>(null);
    const refreshPlacementPreviewFromSessionRef = useRef<
        ((session: PointerSession) => void) | null
    >(null);
    const controllerHandlersRef =
        useRef<InstancedBlockInteractionControllerApi>({
            onClick: () => undefined,
            onPickupPointerEnter: () => undefined,
            onPointerDown: () => undefined,
            onPointerEnter: () => undefined,
            onPointerLeave: () => undefined,
            onPointerUp: () => undefined,
            onSelectClick: () => undefined,
        });

    const targetsByKey = useMemo(
        () => new Map(targets.map((target) => [target.key, target])),
        [targets],
    );
    const targetsByKeyRef = useRef(targetsByKey);

    useEffect(() => {
        updateGameProfileMetadata(
            getInstancedInteractionMountProfileMetadata({
                mounted: true,
                targetCount: targets.length,
            }),
        );
        return () => {
            updateGameProfileMetadata(
                getInstancedInteractionMountProfileMetadata({
                    mounted: false,
                    targetCount: targets.length,
                }),
            );
        };
    }, [targets.length]);

    useEffect(() => {
        updateGameProfileMetadata({
            instancedInteractionTargetCount: targets.length,
        });
    }, [targets.length]);

    const stopDragAutopan = useCallback((session: PointerSession) => {
        if (session.dragAutopanFrame !== null) {
            window.cancelAnimationFrame(session.dragAutopanFrame);
            session.dragAutopanFrame = null;
        }
        session.dragAutopanPreviousTime = null;
    }, []);

    const cleanupPointerSessionListeners = useCallback(() => {
        pointerSessionCleanup.current?.();
        pointerSessionCleanup.current = null;
    }, []);

    const clearPickupInteractionState = useCallback(() => {
        setIsBlocked(false);
        setIsOverRecycler(false);
        setPickupOutlineVisible(false);
        setPickupBlock(null);
        clearPickupSelectionTargets();
        setItemsHudDropTargetActive(false);
    }, [
        clearPickupSelectionTargets,
        setItemsHudDropTargetActive,
        setPickupBlock,
    ]);

    const resetPickupVisualState = useCallback(() => {
        setActiveDragPreview(null);
        clearPickupInteractionState();
    }, [clearPickupInteractionState, setActiveDragPreview]);

    const cancelPointerSession = useCallback(
        (resetSpring: boolean) => {
            const session = pointerSession.current;
            if (!session) {
                return;
            }

            session.cancelled = true;
            clearPointerSessionTimers(session);
            stopDragAutopan(session);
            pointerSession.current = null;
            cleanupPointerSessionListeners();
            setPickupOutlineVisible(false);
            setItemsHudDropTargetActive(false);
            setStationaryPickupOutlineTarget(null);
            if (resetSpring) {
                dragSpringsApi.start({ internalPosition: [0, 0, 0], scale: 1 });
            }
        },
        [
            cleanupPointerSessionListeners,
            dragSpringsApi,
            setItemsHudDropTargetActive,
            setStationaryPickupOutlineTarget,
            stopDragAutopan,
        ],
    );

    useLayoutEffect(() => {
        targetsByKeyRef.current = targetsByKey;

        const session = pointerSession.current;
        const sessionReconciliation =
            resolveInstancedInteractionTargetReconciliation(
                session?.target ?? null,
                targetsByKey,
            );
        if (session && sessionReconciliation.type === 'refresh') {
            session.target = sessionReconciliation.target;
            setVisualTarget(sessionReconciliation.target);
        } else if (session && sessionReconciliation.type === 'cancel') {
            if (session.activated) {
                suppressBlockInteractions(suppressClickAfterDragMs);
            }
            resetPickupVisualState();
            cancelPointerSession(true);
            setVisualTarget(null);
        }

        const currentVisualTarget = visualTarget;
        const visualTargetReconciliation =
            resolveInstancedInteractionTargetReconciliation(
                currentVisualTarget,
                targetsByKey,
            );
        if (
            visualTargetReconciliation.type === 'refresh' &&
            visualTargetReconciliation.target !== currentVisualTarget
        ) {
            setVisualTarget(visualTargetReconciliation.target);
        } else if (visualTargetReconciliation.type === 'cancel') {
            setVisualTarget(null);
        }

        const currentHoveredTarget = hoveredTarget.current;
        const hoveredTargetReconciliation =
            resolveInstancedInteractionTargetReconciliation(
                currentHoveredTarget,
                targetsByKey,
            );
        if (hoveredTargetReconciliation.type === 'refresh') {
            hoveredTarget.current = hoveredTargetReconciliation.target;
        } else if (hoveredTargetReconciliation.type === 'cancel') {
            if (
                useHoveredBlockStore.getState().hoveredBlock ===
                currentHoveredTarget?.block
            ) {
                useHoveredBlockStore.getState().setHoveredBlock(null);
            }
            hoveredTarget.current = null;
        }

        if (
            rotationPointerSession.current &&
            !targetsByKey.has(rotationPointerSession.current.targetKey)
        ) {
            rotationPointerSession.current = null;
        }
        if (firstTap.current && !targetsByKey.has(firstTap.current.targetKey)) {
            firstTap.current = null;
        }
    }, [
        cancelPointerSession,
        resetPickupVisualState,
        targetsByKey,
        visualTarget,
    ]);

    useEffect(() => {
        return () => {
            const session = pointerSession.current;
            if (session) {
                session.cancelled = true;
                if (session.hintTimer) {
                    window.clearTimeout(session.hintTimer);
                }
                if (session.holdTimer) {
                    window.clearTimeout(session.holdTimer);
                }
                stopDragAutopan(session);
            }
            pointerSession.current = null;
            pointerSessionCleanup.current?.();
            pointerSessionCleanup.current = null;
            const gameState = gameStateStore?.getState();
            gameState?.setActiveDragPreview(null);
            gameState?.setPickupBlock(null);
            gameState?.clearPickupSelectionTargets();
            gameState?.setStationaryPickupOutlineTarget(null);
            gameState?.setItemsHudDropTargetActive(false);
        };
    }, [gameStateStore, stopDragAutopan]);

    const visualPreviewTarget = useMemo(
        () => (visualTarget ? createPreviewTarget(visualTarget) : null),
        [visualTarget],
    );

    useLayoutEffect(() => {
        if (!pickupOutlineVisible || !visualPreviewTarget) {
            setStationaryPickupOutlineTarget(null);
            return;
        }

        setStationaryPickupOutlineTarget(visualPreviewTarget);
        return () => setStationaryPickupOutlineTarget(null);
    }, [
        pickupOutlineVisible,
        setStationaryPickupOutlineTarget,
        visualPreviewTarget,
    ]);

    function getMovingSegments(
        target: BlockInteractionLayerTarget,
        activePreviewTarget: ActiveDragPreviewTarget,
        garden: CurrentGarden | null | undefined = getCurrentGarden(),
    ): MovingSegment[] {
        if (!garden || target.blockIndex < 0) {
            return [];
        }

        const sourceBlocks = target.stack.blocks.slice(target.blockIndex);
        if (sourceBlocks.length === 0) {
            return [];
        }

        const raisedBed = findRaisedBedByBlockId(garden, target.block.id);
        const canRecycle = (raisedBed?.status ?? 'new') === 'new';
        const canRecycleSelection = canRecycle && sourceBlocks.length === 1;

        return createPickupSelectionMovingSegments({
            blockData: blocksData,
            canRecyclePrimarySegment: canRecycleSelection,
            primaryTarget: activePreviewTarget,
            selectedTargets:
                gameStateStore?.getState().pickupSelectionTargets ?? [],
            stacks: garden.stacks,
        });
    }

    function createPlacementPreviewResolver(
        session: PointerSession,
        garden: CurrentGarden | null | undefined = getCurrentGarden(),
    ) {
        if (!garden || !blocksData || session.target.blockIndex < 0) {
            return null;
        }

        const movingSegments = getMovingSegments(
            session.target,
            session.activePreviewTarget,
            garden,
        );
        if (movingSegments.length === 0) {
            return null;
        }

        return createPickupPlacementPreviewResolver({
            blockData: blocksData,
            gardenIsSandbox: garden.isSandbox,
            localSandboxStorageKey,
            movingSegments,
            stacks: garden.stacks,
        });
    }

    function getPlacementCandidateDestinations(
        target: BlockInteractionLayerTarget,
        seedDestination: {
            x: number;
            z: number;
        },
    ) {
        const candidates = new Map<string, { x: number; z: number }>();
        const addCandidate = (x: number, z: number) => {
            candidates.set(`${x}|${z}`, { x, z });
        };

        for (
            let x = seedDestination.x - placementSnapSearchRadius;
            x <= seedDestination.x + placementSnapSearchRadius;
            x++
        ) {
            for (
                let z = seedDestination.z - placementSnapSearchRadius;
                z <= seedDestination.z + placementSnapSearchRadius;
                z++
            ) {
                addCandidate(x, z);
            }
        }

        addCandidate(target.stack.position.x, target.stack.position.z);

        return candidates.values();
    }

    function getProjectedPointerDistanceSquared({
        x,
        y,
        z,
        clientX,
        clientY,
        rect,
    }: {
        x: number;
        y: number;
        z: number;
        clientX: number;
        clientY: number;
        rect: DOMRect;
    }) {
        const projected = dragState.current.projected
            .set(x, y, z)
            .project(camera);
        if (projected.z < -1 || projected.z > 1) {
            return Number.POSITIVE_INFINITY;
        }

        const screenX = rect.left + ((projected.x + 1) / 2) * rect.width;
        const screenY = rect.top + ((1 - projected.y) / 2) * rect.height;
        return (screenX - clientX) ** 2 + (screenY - clientY) ** 2;
    }

    function resolvePlacementPreviewAtDestination(
        session: PointerSession,
        destination: {
            x: number;
            z: number;
        },
        resolver?: PickupPlacementPreviewResolver | null,
    ) {
        const { relative } = dragState.current;
        relative.set(
            destination.x - session.target.stack.position.x,
            0,
            destination.z - session.target.stack.position.z,
        );
        return (
            (
                resolver ?? createPlacementPreviewResolver(session)
            )?.resolveForRelative(relative) ?? null
        );
    }

    function resolvePlacementPreview(
        session: PointerSession,
        clientX: number,
        clientY: number,
    ): ResolvedPlacementPreview | null {
        const garden = getCurrentGarden();
        if (!garden || !blocksData || session.target.blockIndex < 0) {
            return null;
        }

        const rect = domElement.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) {
            return null;
        }
        const resolver = createPlacementPreviewResolver(session, garden);
        if (!resolver) {
            return null;
        }

        const { pt, dest } = dragState.current;
        pt.set(
            ((clientX - rect.left) / rect.width) * 2 - 1,
            ((rect.top - clientY) / rect.height) * 2 + 1,
            0,
        );

        pointerVector.current.set(pt.x, pt.y);
        raycaster.current.setFromCamera(pointerVector.current, camera);
        const isIntersecting = raycaster.current.ray.intersectPlane(
            groundPlane,
            pt,
        );
        if (!isIntersecting) {
            return null;
        }

        dest.set(
            pt.x - session.pickupAnchorOffset.x,
            0,
            pt.z - session.pickupAnchorOffset.z,
        ).round();

        let closestPreview: ResolvedPlacementPreview | null = null;
        let closestDistanceSquared = Number.POSITIVE_INFINITY;

        for (const candidateDestination of getPlacementCandidateDestinations(
            session.target,
            {
                x: dest.x,
                z: dest.z,
            },
        )) {
            const preview = resolvePlacementPreviewAtDestination(
                session,
                candidateDestination,
                resolver,
            );
            if (!preview) {
                continue;
            }

            const distanceSquared = getProjectedPointerDistanceSquared({
                x: candidateDestination.x + session.pickupAnchorOffset.x,
                y:
                    session.target.stackHeight +
                    preview.previewHoverHeight +
                    pickupLift +
                    session.pickupAnchorOffset.y,
                z: candidateDestination.z + session.pickupAnchorOffset.z,
                clientX,
                clientY,
                rect,
            });

            if (distanceSquared < closestDistanceSquared) {
                closestDistanceSquared = distanceSquared;
                closestPreview = preview;
            }
        }

        return closestPreview;
    }

    function createActivePreviewResetQueue() {
        let resetQueued = false;

        const clearAfterSceneCommit = () => {
            const previewToClear =
                gameStateStore?.getState().activeDragPreview ?? null;

            window.requestAnimationFrame(() => {
                window.requestAnimationFrame(() => {
                    if (
                        previewToClear &&
                        gameStateStore?.getState().activeDragPreview !==
                            previewToClear
                    ) {
                        return;
                    }

                    setActiveDragPreview(null);
                });
            });
        };

        return {
            queue: () => {
                if (resetQueued) {
                    return;
                }

                resetQueued = true;
                clearAfterSceneCommit();
            },
            resetIfUnqueued: () => {
                if (!resetQueued) {
                    setActiveDragPreview(null);
                }
            },
        };
    }

    function applyActivePreview(
        session: PointerSession,
        preview: ResolvedPlacementPreview,
    ) {
        setIsOverRecycler((current) =>
            current === preview.nextIsOverRecycler
                ? current
                : preview.nextIsOverRecycler,
        );
        setIsBlocked((current) =>
            current === preview.nextIsBlocked ? current : preview.nextIsBlocked,
        );
        setActiveDragPreview({
            source: session.activePreviewTarget,
            targets: preview.targetOffsets,
            hoveredGardenBoxBlockId: preview.hoveredGardenBoxBlockId,
            relative: {
                x: preview.relative.x,
                z: preview.relative.z,
            },
            isBlocked: preview.nextIsBlocked,
            isOverRecycler: preview.nextIsOverRecycler,
        });
        dragSpringsApi.start({
            internalPosition: [
                preview.relative.x,
                preview.previewHoverHeight + pickupLift,
                preview.relative.z,
            ],
            scale: 1.02,
        });
    }

    function refreshPlacementPreviewFromSession(session: PointerSession) {
        const preview = resolvePlacementPreview(
            session,
            session.lastClientX,
            session.lastClientY,
        );
        if (
            !preview ||
            resolvedPlacementPreviewsEqual(session.latestPreview, preview)
        ) {
            return;
        }

        session.latestPreview = preview;
        applyActivePreview(session, preview);
    }
    refreshPlacementPreviewFromSessionRef.current =
        refreshPlacementPreviewFromSession;

    useEffect(() => {
        const session = pointerSession.current;
        if (
            !session?.activated ||
            pickupSelectionTargets.length === 0 ||
            !activeDragPreviewTargetMatches(
                activeDragPreview?.source,
                session.activePreviewTarget,
            )
        ) {
            return;
        }

        refreshPlacementPreviewFromSessionRef.current?.(session);
    }, [activeDragPreview?.source, pickupSelectionTargets]);

    function startDragAutopan(session: PointerSession) {
        if (session.dragAutopanFrame !== null || !gameCamera) {
            return;
        }

        const tick = (timestamp: number) => {
            const activeSession = pointerSession.current;
            if (
                activeSession !== session ||
                activeSession.cancelled ||
                !activeSession.activated
            ) {
                stopDragAutopan(session);
                return;
            }

            const pointer = {
                clientX: activeSession.lastClientX,
                clientY: activeSession.lastClientY,
            };
            if (
                isPointOverItemsHudDropTarget(pointer.clientX, pointer.clientY)
            ) {
                activeSession.dragAutopanPreviousTime = timestamp;
                activeSession.dragAutopanFrame =
                    window.requestAnimationFrame(tick);
                return;
            }

            const previousTime =
                activeSession.dragAutopanPreviousTime ?? timestamp;
            activeSession.dragAutopanPreviousTime = timestamp;
            const frameDeltaSeconds = Math.max(
                0,
                (timestamp - previousTime) / 1000,
            );
            const didPan = gameCamera.panByDragEdge(pointer, frameDeltaSeconds);

            if (didPan) {
                refreshPlacementPreviewFromSession(activeSession);
            }

            activeSession.dragAutopanFrame = window.requestAnimationFrame(tick);
        };

        session.dragAutopanFrame = window.requestAnimationFrame(tick);
    }

    function activatePickup() {
        const session = pointerSession.current;
        if (!session || session.cancelled || session.activated) {
            return;
        }

        const preview = resolvePlacementPreviewAtDestination(session, {
            x: session.target.stack.position.x,
            z: session.target.stack.position.z,
        });
        if (!preview) {
            cancelPointerSession(true);
            return;
        }

        session.activated = true;
        session.pickupClientX = session.lastClientX;
        session.pickupClientY = session.lastClientY;
        session.hasDraggedAfterPickup = false;
        session.latestPreview = preview;
        setIsDragging(false);
        setPickupOutlineVisible(true);
        setPickupBlock(session.target.block);
        setPickupSelectionTargets([session.activePreviewTarget]);
        useHoveredBlockStore.getState().setHoveredBlock(null);
        disturbAnimals({
            sourceBlockId: session.target.block.id,
            sourceBlockName: session.target.block.name,
            position: {
                x: session.target.stack.position.x,
                y: session.target.stackHeight,
                z: session.target.stack.position.z,
            },
            radius: animalPickupDisturbanceRadius,
        });
        pickupSound.play();
        triggerPickHaptic();
        spawn(
            resolveBlockParticleType(session.target.block.name),
            session.target.stack.position
                .clone()
                .setY(session.target.stackHeight),
            4,
        );
        applyActivePreview(session, preview);
    }

    async function finishPickup(
        session: PointerSession,
        preview: ResolvedPlacementPreview | null,
        {
            hudDropRequested,
        }: {
            hudDropRequested: boolean;
        },
    ) {
        const target = session.target;
        const garden = getCurrentGarden();
        const raisedBed = findRaisedBedByBlockId(garden, target.block.id);
        const movingSegments = getMovingSegments(
            target,
            session.activePreviewTarget,
            garden,
        );
        const hudDropAction = hudDropRequested
            ? resolvePickupHudDropAction({
                  forceDelete: Boolean(garden?.isSandbox),
                  movingSegments,
              })
            : null;
        const blockIdsToDelete =
            hudDropAction?.type === 'delete' ? hudDropAction.blockIds : [];

        if (blockIdsToDelete.length > 0) {
            resetPickupVisualState();
            dragSpringsApi.start({
                internalPosition: preview
                    ? [
                          preview.relative.x,
                          preview.previewHoverHeight + 0.2,
                          preview.relative.z,
                      ]
                    : [0, pickupLift, 0],
                scale: 0.1,
            });
            dropSound.play();
            triggerPlaceHaptic();
            try {
                await deleteBlocks.mutateAsync({
                    blockIds: blockIdsToDelete,
                });
            } finally {
                dragSpringsApi.start({
                    internalPosition: [0, 0, 0],
                    scale: 1,
                });
            }
            return;
        }

        if (hudDropAction?.type === 'recycle') {
            clearPickupInteractionState();
            const activePreviewReset = createActivePreviewResetQueue();
            dragSpringsApi.start({
                internalPosition: preview
                    ? [preview.relative.x, -1.5, preview.relative.z]
                    : [0, -1.5, 0],
                scale: 0.1,
            });
            triggerPlaceHaptic();
            await recycleBlock
                .mutateAsync({
                    position: target.stack.position,
                    blockId: target.block.id,
                    blockIndex: target.blockIndex,
                    raisedBedId: raisedBed?.id,
                    onOptimisticUpdate: activePreviewReset.queue,
                })
                .finally(activePreviewReset.resetIfUnqueued);
            return;
        }

        if (hudDropRequested) {
            resetPickupVisualState();
            dragSpringsApi.start({ internalPosition: [0, 0, 0], scale: 1 });
            return;
        }

        if (!preview || preview.nextIsBlocked) {
            resetPickupVisualState();
            dragSpringsApi.start({ internalPosition: [0, 0, 0], scale: 1 });
            return;
        }

        const relative = preview.relative;
        const hasMoved =
            Math.abs(relative.x) > 0.0001 || Math.abs(relative.z) > 0.0001;

        if (
            !hasMoved &&
            !preview.canStoreInGardenBox &&
            !preview.nextIsOverRecycler
        ) {
            resetPickupVisualState();
            dragSpringsApi.start({ internalPosition: [0, 0, 0], scale: 1 });
            return;
        }

        const previewDropPosition = target.stack.position
            .clone()
            .add(relative)
            .setY(preview.previewHoverHeight + target.stackHeight);

        if (preview.canStoreInGardenBox && preview.hoveredGardenBoxBlockId) {
            clearPickupInteractionState();
            const activePreviewReset = createActivePreviewResetQueue();
            dragSpringsApi.start({
                internalPosition: [
                    relative.x,
                    preview.previewHoverHeight + 0.2,
                    relative.z,
                ],
                scale: 0.1,
            });
            dropSound.play();
            triggerPlaceHaptic();
            spawn(
                resolveBlockParticleType(target.block.name),
                previewDropPosition,
                8,
            );
            const blockDataForInventory = getBlockDataByName(
                blocksData,
                target.block.name,
            );

            await storeBlockInGardenBox
                .mutateAsync({
                    sourcePosition: {
                        x: target.stack.position.x,
                        z: target.stack.position.z,
                    },
                    blockIndex: target.blockIndex,
                    sourceBlockId: target.block.id,
                    blockName: target.block.name,
                    blockEntityId: blockDataForInventory?.id.toString(),
                    blockLabel:
                        blockDataForInventory?.information?.label ??
                        target.block.name,
                    gardenBoxBlockId: preview.hoveredGardenBoxBlockId,
                    onOptimisticUpdate: activePreviewReset.queue,
                })
                .finally(activePreviewReset.resetIfUnqueued);
            return;
        }

        if (preview.nextIsOverRecycler) {
            clearPickupInteractionState();
            const activePreviewReset = createActivePreviewResetQueue();
            dragSpringsApi.start({
                internalPosition: [relative.x, -1.5, relative.z],
                scale: 0.1,
            });
            triggerPlaceHaptic();
            await recycleBlock
                .mutateAsync({
                    position: target.stack.position,
                    blockId: target.block.id,
                    blockIndex: target.blockIndex,
                    raisedBedId: raisedBed?.id,
                    onOptimisticUpdate: activePreviewReset.queue,
                })
                .finally(activePreviewReset.resetIfUnqueued);
            return;
        }

        const moveRequests = createPickupSelectionMoveRequests(
            movingSegments,
            relative,
        );
        const [primaryMoveRequest, ...additionalBlockMoves] = moveRequests;
        if (!primaryMoveRequest) {
            resetPickupVisualState();
            dragSpringsApi.start({ internalPosition: [0, 0, 0], scale: 1 });
            return;
        }

        clearPickupInteractionState();
        const activePreviewReset = createActivePreviewResetQueue();
        dragSpringsApi.start({
            internalPosition: [
                relative.x,
                preview.previewHoverHeight,
                relative.z,
            ],
            scale: 1,
        });
        dropSound.play();
        triggerPlaceHaptic();
        spawn(
            resolveBlockParticleType(target.block.name),
            previewDropPosition,
            8,
        );

        await moveBlock
            .mutateAsync({
                ...primaryMoveRequest,
                additionalBlocks: additionalBlockMoves,
                onOptimisticUpdate: activePreviewReset.queue,
            })
            .finally(activePreviewReset.resetIfUnqueued);
    }

    function handleWindowPointerMove(event: PointerEvent) {
        const session = pointerSession.current;
        if (!session || event.pointerId !== session.pointerId) {
            return;
        }

        session.lastClientX = event.clientX;
        session.lastClientY = event.clientY;

        if (!session.activated) {
            if (
                pointerDistance(session, event.clientX, event.clientY) >
                getPickupPointerMoveCancelDistance(session.pointerType)
            ) {
                cancelPointerSession(session.hintVisible);
            }
            return;
        }

        event.preventDefault();
        if (!session.hasDraggedAfterPickup) {
            const pickupClientX = session.pickupClientX ?? session.startClientX;
            const pickupClientY = session.pickupClientY ?? session.startClientY;

            if (
                Math.hypot(
                    event.clientX - pickupClientX,
                    event.clientY - pickupClientY,
                ) <= getPickupPointerMoveCancelDistance(session.pointerType)
            ) {
                return;
            }

            session.hasDraggedAfterPickup = true;
            startDragAutopan(session);
        }

        setItemsHudDropTargetActive(
            isPointOverItemsHudDropTarget(event.clientX, event.clientY),
        );

        refreshPlacementPreviewFromSession(session);
    }

    function handleWindowPointerUp(event: PointerEvent) {
        const session = pointerSession.current;
        if (!session || event.pointerId !== session.pointerId) {
            return;
        }

        clearPointerSessionTimers(session);
        stopDragAutopan(session);
        cleanupPointerSessionListeners();
        pointerSession.current = null;

        if (!session.activated) {
            if (session.hintVisible) {
                dragSpringsApi.start({
                    internalPosition: [0, 0, 0],
                    scale: 1,
                });
            }
            setPickupOutlineVisible(false);
            setStationaryPickupOutlineTarget(null);
            return;
        }

        event.preventDefault();
        suppressBlockInteractions(suppressClickAfterDragMs);
        const preview =
            resolvePlacementPreview(
                session,
                session.lastClientX,
                session.lastClientY,
            ) ?? session.latestPreview;
        void finishPickup(session, preview, {
            hudDropRequested: isPointOverItemsHudDropTarget(
                session.lastClientX,
                session.lastClientY,
            ),
        });
    }

    function handleWindowPointerCancel(event: PointerEvent) {
        const session = pointerSession.current;
        if (!session || event.pointerId !== session.pointerId) {
            return;
        }

        suppressBlockInteractions(suppressClickAfterDragMs);
        resetPickupVisualState();
        cancelPointerSession(true);
    }

    function handlePickupPointerEnter(
        target: BlockInteractionLayerTarget,
        event: ThreeEvent<PointerEvent>,
    ) {
        if (
            target.blockIndex < 0 ||
            !event.nativeEvent.shiftKey ||
            !gameStateStore
        ) {
            return false;
        }

        const gameState = gameStateStore.getState();
        const preview = gameState.activeDragPreview;
        const activePreviewTarget = createPreviewTarget(target);
        if (
            !preview ||
            activeDragPreviewAffectsTarget(preview, activePreviewTarget)
        ) {
            return false;
        }

        const added = gameState.addPickupSelectionTarget(activePreviewTarget);
        if (!added) {
            return false;
        }

        event.stopPropagation();
        triggerSelectionHaptic();
        return true;
    }

    function handlePointerDown(
        target: BlockInteractionLayerTarget,
        event: ThreeEvent<PointerEvent>,
    ) {
        if (event.button === 0 && handlePickupPointerEnter(target, event)) {
            return;
        }

        if (
            event.button !== 0 ||
            pointerSession.current ||
            areBlockInteractionsSuppressed() ||
            !getCurrentGarden() ||
            !blocksData ||
            target.blockIndex < 0
        ) {
            return;
        }

        event.stopPropagation();
        setVisualTarget(target);
        setIsBlocked(false);
        setIsOverRecycler(false);
        dragSpringsApi.set({ internalPosition: [0, 0, 0], scale: 1 });

        const nativeEvent = event.nativeEvent;
        const session: PointerSession = {
            target,
            activePreviewTarget: createPreviewTarget(target),
            pointerId: nativeEvent.pointerId,
            pointerType: nativeEvent.pointerType,
            startClientX: nativeEvent.clientX,
            startClientY: nativeEvent.clientY,
            lastClientX: nativeEvent.clientX,
            lastClientY: nativeEvent.clientY,
            pickupClientX: null,
            pickupClientY: null,
            pickupAnchorOffset: {
                x: event.point.x - target.stack.position.x,
                y: event.point.y - target.stackHeight,
                z: event.point.z - target.stack.position.z,
            },
            hasDraggedAfterPickup: false,
            activated: false,
            cancelled: false,
            hintVisible: false,
            hintTimer: null,
            holdTimer: null,
            dragAutopanFrame: null,
            dragAutopanPreviousTime: null,
            latestPreview: null,
        };
        pointerSession.current = session;

        session.hintTimer = window.setTimeout(() => {
            const activeSession = pointerSession.current;
            if (
                activeSession !== session ||
                activeSession.cancelled ||
                activeSession.activated
            ) {
                return;
            }

            activeSession.hintVisible = true;
            setPickupOutlineVisible(true);
            dragSpringsApi.start({
                internalPosition: [0, pickupHintLift, 0],
                scale: 1.01,
            });
        }, pickupHintDelayMs);

        session.holdTimer = window.setTimeout(
            activatePickup,
            pickupHoldDelayMs,
        );

        window.addEventListener('pointermove', handleWindowPointerMove, {
            passive: false,
        });
        window.addEventListener('pointerup', handleWindowPointerUp);
        window.addEventListener('pointercancel', handleWindowPointerCancel);
        pointerSessionCleanup.current = () => {
            window.removeEventListener('pointermove', handleWindowPointerMove);
            window.removeEventListener('pointerup', handleWindowPointerUp);
            window.removeEventListener(
                'pointercancel',
                handleWindowPointerCancel,
            );
        };
    }

    function handleClick(event: ThreeEvent<MouseEvent>) {
        if (areBlockInteractionsSuppressed()) {
            event.stopPropagation();
        }
    }

    function handlePointerEnter(
        target: BlockInteractionLayerTarget,
        event: ThreeEvent<PointerEvent>,
    ) {
        if (
            !isSelectableTarget(target) ||
            gameStateStore?.getState().activeDragPreview
        ) {
            return;
        }

        hoveredTarget.current = target;
        event.stopPropagation();
        useHoveredBlockStore.getState().setHoveredBlock(target.block);
    }

    function handlePointerLeave(
        target: BlockInteractionLayerTarget | null,
        event: ThreeEvent<PointerEvent>,
    ) {
        rotationPointerSession.current = null;
        const currentHoveredTarget = hoveredTarget.current;
        const targetKey = target?.key ?? currentHoveredTarget?.key;
        if (!targetKey) {
            return;
        }

        const hoveredBlock = useHoveredBlockStore.getState().hoveredBlock;
        const targetBlock =
            targetsByKey.get(targetKey)?.block ??
            target?.block ??
            currentHoveredTarget?.block;
        if (targetBlock && hoveredBlock === targetBlock) {
            event.stopPropagation();
            useHoveredBlockStore.getState().setHoveredBlock(null);
        }
        if (hoveredTarget.current?.key === targetKey) {
            hoveredTarget.current = null;
        }
    }

    function handleDeferredSelection(targetKey: string) {
        const target = targetsByKeyRef.current.get(targetKey);
        if (!target || gameStateStore?.getState().activeDragPreview) {
            return;
        }

        if (target.block.name === 'GardenBox') {
            if (!getCurrentGarden()?.isSandbox) {
                setOpenGardenBoxBlockId(target.block.id);
            }
            return;
        }

        const garden = getCurrentGarden();
        const raisedBed =
            target.block.name === 'Raised_Bed'
                ? findRaisedBedByBlockId(garden, target.block.id)
                : null;
        if (target.block.name === 'Raised_Bed' && raisedBed) {
            track('game_raised_bed_opened', {
                block_id: target.block.id,
                raised_bed_name: raisedBed.name,
            });
            setRaisedBedCloseupParam(raisedBed.name);
            useHoveredBlockStore.getState().setHoveredBlock(null);
            return;
        }

        if (target.block.name.startsWith('GiftBox_')) {
            setGiftBoxParam(target.block.id);
        }
    }

    const handleDeferredSelectionClick = useDeferredSingleClickByTarget(
        handleDeferredSelection,
        targetsByKey,
    );

    function handleSelectClick(
        target: BlockInteractionLayerTarget,
        event: ThreeEvent<MouseEvent>,
    ) {
        if (!isSelectableTarget(target)) {
            event.stopPropagation();
            return;
        }

        handleDeferredSelectionClick(target.key, event);
    }

    function doRotate(target: BlockInteractionLayerTarget) {
        if (!canRotatePlacedBlock(target.block.name)) {
            return false;
        }

        const gameState = gameStateStore?.getState();
        if (
            gameState?.isDragging ||
            gameState?.pickupBlock ||
            gameState?.hudPlacementDrag
        ) {
            return false;
        }

        blockRotate.mutate({
            blockId: target.block.id,
            rotation: target.block.rotation + 1,
            blockIds: [target.block.id],
        });

        swipeSound.play();
        return true;
    }

    function handleRotatePointerDown(
        target: BlockInteractionLayerTarget,
        event: ThreeEvent<PointerEvent>,
    ) {
        if (event.button !== 0) {
            return;
        }

        rotationPointerSession.current = {
            point: event.point.clone(),
            targetKey: target.key,
        };
    }

    function handleRotatePointerUp(
        target: BlockInteractionLayerTarget,
        event: ThreeEvent<PointerEvent>,
    ) {
        if (event.button !== 0) {
            return;
        }

        const pointerDown = rotationPointerSession.current;
        rotationPointerSession.current = null;
        if (!pointerDown || pointerDown.targetKey !== target.key) {
            firstTap.current = null;
            return;
        }

        const tap = resolveInstancedRotationTap({
            distance: event.point.distanceTo(pointerDown.point),
            doubleTapThresholdMs,
            now: Date.now(),
            previousTap: firstTap.current,
            targetKey: target.key,
            dragThreshold: rotateDragThreshold,
        });
        firstTap.current = tap.nextTap;
        if (!tap.shouldRotate) {
            return;
        }

        if (doRotate(target)) {
            event.stopPropagation();
        }
    }

    controllerHandlersRef.current = {
        onClick: (_target, event) => handleClick(event),
        onPickupPointerEnter: handlePickupPointerEnter,
        onPointerDown: (target, event) => {
            handleRotatePointerDown(target, event);
            handlePointerDown(target, event);
        },
        onPointerEnter: handlePointerEnter,
        onPointerLeave: handlePointerLeave,
        onPointerUp: handleRotatePointerUp,
        onSelectClick: handleSelectClick,
    };

    const controller = useMemo<InstancedBlockInteractionControllerApi>(
        () => ({
            onClick: (target, event) =>
                controllerHandlersRef.current.onClick(target, event),
            onPickupPointerEnter: (target, event) =>
                controllerHandlersRef.current.onPickupPointerEnter(
                    target,
                    event,
                ),
            onPointerDown: (target, event) =>
                controllerHandlersRef.current.onPointerDown(target, event),
            onPointerEnter: (target, event) =>
                controllerHandlersRef.current.onPointerEnter(target, event),
            onPointerLeave: (target, event) =>
                controllerHandlersRef.current.onPointerLeave(target, event),
            onPointerUp: (target, event) =>
                controllerHandlersRef.current.onPointerUp(target, event),
            onSelectClick: (target, event) =>
                controllerHandlersRef.current.onSelectClick(target, event),
        }),
        [],
    );

    const blockedTargets =
        activeDragPreview?.isBlocked === true
            ? activeDragPreview.targets
                  .map((previewTarget) => {
                      const target = targetsByKey.get(
                          targetKeyFromPreviewTarget(previewTarget),
                      );
                      return target
                          ? {
                                key: target.key,
                                position: [
                                    target.stack.position.x +
                                        activeDragPreview.relative.x,
                                    target.stackHeight +
                                        previewTarget.hoverHeight +
                                        pickupLift,
                                    target.stack.position.z +
                                        activeDragPreview.relative.z,
                                ] as [number, number, number],
                            }
                          : null;
                  })
                  .filter((target) => target !== null)
            : [];
    const showBlockedIndicator = isBlocked || blockedTargets.length > 0;
    const blockedScaleSprings = useSpring({
        scale: showBlockedIndicator ? 1 : 0,
        opacity: showBlockedIndicator ? 1 : 0,
        config: {
            tension: 350,
        },
    });
    const dragPosition = dragSprings.internalPosition as unknown as [
        number,
        number,
        number,
    ];
    const fallbackBlockedPosition: [number, number, number] | null =
        isBlocked && visualTarget
            ? [
                  visualTarget.stack.position.x,
                  visualTarget.stackHeight,
                  visualTarget.stack.position.z,
              ]
            : null;
    const recyclePosition: [number, number, number] | null = visualTarget
        ? [
              visualTarget.stack.position.x,
              visualTarget.stackHeight + 0.2,
              visualTarget.stack.position.z,
          ]
        : null;

    return (
        <>
            {children(controller)}
            {blockedTargets.map((target) => (
                <animated.group
                    key={`blocked-${target.key}`}
                    scale={blockedScaleSprings.scale}
                    position={target.position}
                >
                    <Shadow
                        color={0xff0000}
                        opacity={1}
                        colorStop={0.5}
                        scale={2}
                    />
                </animated.group>
            ))}
            {blockedTargets.length === 0 && fallbackBlockedPosition ? (
                <animated.group
                    position={dragPosition}
                    scale={dragSprings.scale}
                >
                    <animated.group
                        scale={blockedScaleSprings.scale}
                        position={fallbackBlockedPosition}
                    >
                        <Shadow
                            color={0xff0000}
                            opacity={1}
                            colorStop={0.5}
                            scale={2}
                        />
                    </animated.group>
                </animated.group>
            ) : null}
            {isOverRecycler && recyclePosition ? (
                <animated.group
                    position={dragPosition}
                    scale={dragSprings.scale}
                >
                    <Suspense>
                        <animated.group position={recyclePosition}>
                            <RecycleIndicator />
                        </animated.group>
                    </Suspense>
                </animated.group>
            ) : null}
        </>
    );
}
