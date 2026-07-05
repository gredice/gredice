'use client';

import { animated, useSpring } from '@react-spring/three';
import { Billboard, Shadow, useTexture } from '@react-three/drei';
import { type ThreeEvent, useThree } from '@react-three/fiber';
import {
    type PropsWithChildren,
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
import {
    type ActiveDragPreviewTarget,
    activeDragPreviewTargetMatches,
    createActiveDragPreviewTarget,
    findActiveDragPreviewTargetOffset,
} from '../dragPreviewIdentity';
import { blockPickupOutlineStyle } from '../entities/helpers/blockPickupOutlineStyle';
import { HoverOutline } from '../entities/helpers/HoverOutline';
import { useBlockData } from '../hooks/useBlockData';
import { useBlockDelete } from '../hooks/useBlockDelete';
import { useBlockMove } from '../hooks/useBlockMove';
import { useBlockRecycle } from '../hooks/useBlockRecycle';
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
import type { EntityInstanceProps } from '../types/runtime/EntityInstanceProps';
import {
    type ActiveDragPreview,
    GameStateContext,
    useGameState,
} from '../useGameState';
import {
    getBlockDataByName,
    getStackHeight,
    useStackHeight,
} from '../utils/getStackHeight';
import {
    triggerPickHaptic,
    triggerPlaceHaptic,
    triggerSelectionHaptic,
} from '../utils/haptics';
import {
    findAttachedRaisedBedBlockId,
    findRaisedBedByBlockId,
} from '../utils/raisedBedBlocks';
import { useBlockInteractionTargetRegistration } from './BlockInteractionRegistry';
import {
    areBlockInteractionsSuppressed,
    suppressBlockInteractions,
} from './blockInteractionSuppression';
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
import { useHoveredBlockStore } from './useHoveredBlockStore';

const groundPlane = new Plane(new Vector3(0, 1, 0), 0);
const pickupHintDelayMs = 120;
const pickupHoldDelayMs = 320;
const mouseMoveCancelDistance = 6;
const touchMoveCancelDistance = 12;
const pickupHintLift = 0.04;
const pickupLift = 0.1;
const suppressClickAfterDragMs = 450;
const placementSnapSearchRadius = 5;
const animalPickupDisturbanceRadius = 1.8;

type PickableGroupProps = PropsWithChildren<
    Pick<EntityInstanceProps, 'stack' | 'block'> & {
        interactionTargetKey?: string;
        noControl?: boolean;
        renderPickupOutline?: boolean;
    }
>;

type PickupAnchorOffset = {
    x: number;
    y: number;
    z: number;
};

type PointerSession = {
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

export function RecycleIndicator() {
    const appBaseUrl = useGameState((state) => state.appBaseUrl);
    const recycleTexture = useTexture(
        `${appBaseUrl ?? ''}/assets/textures/recycle.png`,
    );
    return (
        <Billboard follow={true} lockX={false} lockY={false} lockZ={false}>
            <animated.mesh position={[0, 0, 0]} scale={[1, 1, 1]}>
                <planeGeometry />
                <meshBasicMaterial
                    transparent
                    map={recycleTexture}
                    depthTest={false}
                />
            </animated.mesh>
        </Billboard>
    );
}

function pointerMoveCancelDistance(pointerType: string) {
    return pointerType === 'touch'
        ? touchMoveCancelDistance
        : mouseMoveCancelDistance;
}

function pointerDistance(session: PointerSession, x: number, y: number) {
    return Math.hypot(x - session.startClientX, y - session.startClientY);
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

export function PickableGroup({
    children,
    interactionTargetKey,
    stack,
    block,
    noControl,
    renderPickupOutline = true,
}: PickableGroupProps) {
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
    const currentStackHeight = useStackHeight(stack, block);

    const effectsAudioMixer = useGameState((state) => state.audio.effects);
    const gameCamera = useGameState((state) => state.gameCamera);
    const setIsDragging = useGameState((state) => state.setIsDragging);
    const pickupSound = effectsAudioMixer.useSoundEffect(
        'https://cdn.gredice.com/sounds/effects/Pick Grass 01.mp3',
    );
    const dropSound = effectsAudioMixer.useSoundEffect(
        'https://cdn.gredice.com/sounds/effects/Drop Grass 01.mp3',
    );

    const setPickupBlock = useGameState((state) => state.setPickupBlock);
    const setPickupSelectionTargets = useGameState(
        (state) => state.setPickupSelectionTargets,
    );
    const clearPickupSelectionTargets = useGameState(
        (state) => state.clearPickupSelectionTargets,
    );
    const disturbAnimals = useGameState((state) => state.disturbAnimals);
    const setActiveDragPreview = useGameState(
        (state) => state.setActiveDragPreview,
    );
    const setStationaryPickupOutlineTarget = useGameState(
        (state) => state.setStationaryPickupOutlineTarget,
    );
    const setItemsHudDropTargetActive = useGameState(
        (state) => state.setItemsHudDropTargetActive,
    );
    const localSandboxStorageKey = useGameState(
        (state) => state.localSandboxStorageKey,
    );

    const [isBlocked, setIsBlocked] = useState(false);
    const [isOverRecycler, setIsOverRecycler] = useState(false);
    const [pickupOutlineVisible, setPickupOutlineVisible] = useState(false);
    const deleteBlocks = useBlockDelete();
    const moveBlock = useBlockMove();
    const recycleBlock = useBlockRecycle();
    const storeBlockInGardenBox = useGardenBoxStoreBlock();

    const blockIndex = stack.blocks.indexOf(block);
    const activePreviewTarget = useMemo(
        () =>
            createActiveDragPreviewTarget({
                blockId: block.id,
                blockIndex,
                stackPosition: {
                    x: stack.position.x,
                    z: stack.position.z,
                },
            }),
        [block.id, blockIndex, stack.position.x, stack.position.z],
    );
    const activeDragPreview = useGameState((state) =>
        activeDragPreviewAffectsTarget(
            state.activeDragPreview,
            activePreviewTarget,
        )
            ? state.activeDragPreview
            : null,
    );
    const isPreviewSource = activeDragPreviewTargetMatches(
        activeDragPreview?.source,
        activePreviewTarget,
    );
    const sourcePickupSelectionTargets = useGameState((state) =>
        isPreviewSource ? state.pickupSelectionTargets : null,
    );
    const activePreviewTargetOffset = findActiveDragPreviewTargetOffset(
        activeDragPreview?.targets,
        activePreviewTarget,
    );
    const isPreviewTarget = Boolean(activePreviewTargetOffset);
    const wasPreviewTarget = useRef(false);
    const shouldResetTargetOnPreviewEnd = useRef(false);
    const previousStackPosition = useRef({
        x: stack.position.x,
        z: stack.position.z,
    });
    const pointerSession = useRef<PointerSession | null>(null);
    const pointerSessionCleanup = useRef<(() => void) | null>(null);
    const refreshPlacementPreviewFromSessionRef = useRef<
        ((session: PointerSession) => void) | null
    >(null);

    const stopDragAutopan = useCallback((session: PointerSession) => {
        if (session.dragAutopanFrame !== null) {
            window.cancelAnimationFrame(session.dragAutopanFrame);
            session.dragAutopanFrame = null;
        }
        session.dragAutopanPreviousTime = null;
    }, []);

    useEffect(() => {
        const hasStackPositionChanged =
            previousStackPosition.current.x !== stack.position.x ||
            previousStackPosition.current.z !== stack.position.z;

        if (hasStackPositionChanged) {
            dragSpringsApi.set({ internalPosition: [0, 0, 0], scale: 1 });
            setIsBlocked(false);
            setIsOverRecycler(false);
        }

        previousStackPosition.current = {
            x: stack.position.x,
            z: stack.position.z,
        };
    }, [dragSpringsApi, stack.position.x, stack.position.z]);

    useEffect(() => {
        if (isPreviewSource) {
            return;
        }

        if (activePreviewTargetOffset && activeDragPreview) {
            wasPreviewTarget.current = true;
            shouldResetTargetOnPreviewEnd.current =
                activeDragPreview.isBlocked ||
                (Math.abs(activeDragPreview.relative.x) <= 0.0001 &&
                    Math.abs(activeDragPreview.relative.z) <= 0.0001);
            dragSpringsApi.start({
                internalPosition: [
                    activeDragPreview.relative.x,
                    activePreviewTargetOffset.hoverHeight + pickupLift,
                    activeDragPreview.relative.z,
                ],
            });
            return;
        }

        if (!activeDragPreview && wasPreviewTarget.current) {
            wasPreviewTarget.current = false;
            if (shouldResetTargetOnPreviewEnd.current) {
                dragSpringsApi.start({ internalPosition: [0, 0, 0], scale: 1 });
            }
            shouldResetTargetOnPreviewEnd.current = false;
        }
    }, [
        activeDragPreview,
        activePreviewTargetOffset,
        isPreviewSource,
        dragSpringsApi,
    ]);

    useLayoutEffect(() => {
        if (renderPickupOutline || !pickupOutlineVisible) {
            return;
        }

        setStationaryPickupOutlineTarget(activePreviewTarget);
        return () => setStationaryPickupOutlineTarget(null);
    }, [
        activePreviewTarget,
        pickupOutlineVisible,
        renderPickupOutline,
        setStationaryPickupOutlineTarget,
    ]);

    useEffect(() => {
        return () => {
            const session = pointerSession.current;
            if (!session) {
                return;
            }

            if (session.hintTimer) {
                window.clearTimeout(session.hintTimer);
            }
            if (session.holdTimer) {
                window.clearTimeout(session.holdTimer);
            }
            stopDragAutopan(session);
            pointerSessionCleanup.current?.();
            pointerSessionCleanup.current = null;
        };
    }, [stopDragAutopan]);

    function getAttachedPlacement(garden: CurrentGarden | null | undefined) {
        if (block.name !== 'Raised_Bed' || !garden) {
            return null;
        }

        const attachedRaisedBedBlockId = findAttachedRaisedBedBlockId(
            garden.stacks,
            block.id,
        );

        return attachedRaisedBedBlockId
            ? (garden.stacks
                  .flatMap((candidateStack) =>
                      candidateStack.blocks.map(
                          (candidateBlock, candidateBlockIndex) => ({
                              candidateStack,
                              candidateBlock,
                              candidateBlockIndex,
                          }),
                      ),
                  )
                  .find(
                      (candidate) =>
                          candidate.candidateBlock.id ===
                          attachedRaisedBedBlockId,
                  ) ?? null)
            : null;
    }

    function getMovingSegments(
        garden: CurrentGarden | null | undefined = getCurrentGarden(),
    ): MovingSegment[] {
        if (!garden || blockIndex < 0) {
            return [];
        }

        const sourceBlocks = stack.blocks.slice(blockIndex);
        if (sourceBlocks.length === 0) {
            return [];
        }

        const raisedBed = findRaisedBedByBlockId(garden, block.id);
        const canRecycle = garden
            ? (raisedBed?.status ?? 'new') === 'new'
            : false;
        const attachedPlacement = getAttachedPlacement(garden);
        const attachedCurrentStackHeight = attachedPlacement
            ? getStackHeight(
                  blocksData,
                  attachedPlacement.candidateStack,
                  attachedPlacement.candidateBlock,
              )
            : 0;
        const attachedBlocks = attachedPlacement
            ? attachedPlacement.candidateStack.blocks.slice(
                  attachedPlacement.candidateBlockIndex,
              )
            : [];
        const canRecycleSelection =
            canRecycle &&
            sourceBlocks.length === 1 &&
            (!attachedPlacement || attachedBlocks.length === 1);

        return createPickupSelectionMovingSegments({
            attachedSegment:
                attachedPlacement && attachedBlocks.length > 0
                    ? {
                          sourceStack: attachedPlacement.candidateStack,
                          sourceStartIndex:
                              attachedPlacement.candidateBlockIndex,
                          blocks: attachedBlocks,
                          baseHeight: attachedCurrentStackHeight,
                      }
                    : null,
            blockData: blocksData,
            canRecyclePrimarySegment: canRecycleSelection,
            primaryTarget: activePreviewTarget,
            selectedTargets:
                gameStateStore?.getState().pickupSelectionTargets ?? [],
            stacks: garden.stacks,
        });
    }

    function createPlacementPreviewResolver(
        garden: CurrentGarden | null | undefined = getCurrentGarden(),
    ) {
        if (!garden || !blocksData || blockIndex < 0) {
            return null;
        }

        const movingSegments = getMovingSegments(garden);
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

    function getPlacementCandidateDestinations(seedDestination: {
        x: number;
        z: number;
    }) {
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

        addCandidate(stack.position.x, stack.position.z);

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
        destination: {
            x: number;
            z: number;
        },
        resolver?: PickupPlacementPreviewResolver | null,
    ) {
        const { relative } = dragState.current;
        relative.set(
            destination.x - stack.position.x,
            0,
            destination.z - stack.position.z,
        );
        return (
            (resolver ?? createPlacementPreviewResolver())?.resolveForRelative(
                relative,
            ) ?? null
        );
    }

    function resolvePlacementPreview(
        clientX: number,
        clientY: number,
        pickupAnchorOffset: PickupAnchorOffset,
    ): ResolvedPlacementPreview | null {
        const garden = getCurrentGarden();
        if (!garden || !blocksData || blockIndex < 0) {
            return null;
        }

        const rect = domElement.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) {
            return null;
        }
        const resolver = createPlacementPreviewResolver(garden);
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
            pt.x - pickupAnchorOffset.x,
            0,
            pt.z - pickupAnchorOffset.z,
        ).round();

        let closestPreview: ResolvedPlacementPreview | null = null;
        let closestDistanceSquared = Number.POSITIVE_INFINITY;

        for (const candidateDestination of getPlacementCandidateDestinations({
            x: dest.x,
            z: dest.z,
        })) {
            const preview = resolvePlacementPreviewAtDestination(
                candidateDestination,
                resolver,
            );
            if (!preview) {
                continue;
            }

            const distanceSquared = getProjectedPointerDistanceSquared({
                x: candidateDestination.x + pickupAnchorOffset.x,
                y:
                    (currentStackHeight ?? 0) +
                    preview.previewHoverHeight +
                    pickupLift +
                    pickupAnchorOffset.y,
                z: candidateDestination.z + pickupAnchorOffset.z,
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

    function clearSessionTimers(session: PointerSession) {
        if (session.hintTimer) {
            window.clearTimeout(session.hintTimer);
            session.hintTimer = null;
        }
        if (session.holdTimer) {
            window.clearTimeout(session.holdTimer);
            session.holdTimer = null;
        }
    }

    function cleanupPointerSessionListeners() {
        pointerSessionCleanup.current?.();
        pointerSessionCleanup.current = null;
    }

    function resetPickupVisualState() {
        setActiveDragPreview(null);
        clearPickupInteractionState();
    }

    function clearPickupInteractionState() {
        setIsBlocked(false);
        setIsOverRecycler(false);
        setPickupOutlineVisible(false);
        setPickupBlock(null);
        clearPickupSelectionTargets();
        setItemsHudDropTargetActive(false);
    }

    function createActivePreviewResetQueue() {
        let resetQueued = false;

        const clearAfterSceneCommit = () => {
            const previewToClear =
                gameStateStore?.getState().activeDragPreview ?? null;

            // Keep the drag preview through one paint so React Query's optimistic stack update can commit first.
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

    function cancelPointerSession(resetSpring: boolean) {
        const session = pointerSession.current;
        if (!session) {
            return;
        }

        session.cancelled = true;
        clearSessionTimers(session);
        stopDragAutopan(session);
        pointerSession.current = null;
        cleanupPointerSessionListeners();
        setPickupOutlineVisible(false);
        setItemsHudDropTargetActive(false);
        if (resetSpring) {
            dragSpringsApi.start({ internalPosition: [0, 0, 0], scale: 1 });
        }
    }

    function refreshPlacementPreviewFromSession(session: PointerSession) {
        const preview = resolvePlacementPreview(
            session.lastClientX,
            session.lastClientY,
            session.pickupAnchorOffset,
        );
        if (!preview) {
            return;
        }

        if (resolvedPlacementPreviewsEqual(session.latestPreview, preview)) {
            return;
        }

        session.latestPreview = preview;
        applyActivePreview(preview);
    }
    refreshPlacementPreviewFromSessionRef.current =
        refreshPlacementPreviewFromSession;

    useEffect(() => {
        const session = pointerSession.current;
        if (!isPreviewSource || !sourcePickupSelectionTargets || !session) {
            return;
        }

        refreshPlacementPreviewFromSessionRef.current?.(session);
    }, [isPreviewSource, sourcePickupSelectionTargets]);

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

    function applyActivePreview(preview: ResolvedPlacementPreview) {
        setIsOverRecycler((current) =>
            current === preview.nextIsOverRecycler
                ? current
                : preview.nextIsOverRecycler,
        );
        setIsBlocked((current) =>
            current === preview.nextIsBlocked ? current : preview.nextIsBlocked,
        );
        setActiveDragPreview({
            source: activePreviewTarget,
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

    function activatePickup() {
        const session = pointerSession.current;
        if (!session || session.cancelled || session.activated) {
            return;
        }

        const preview = resolvePlacementPreviewAtDestination({
            x: stack.position.x,
            z: stack.position.z,
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
        setPickupBlock(block);
        setPickupSelectionTargets([activePreviewTarget]);
        useHoveredBlockStore.getState().setHoveredBlock(null);
        disturbAnimals({
            sourceBlockId: block.id,
            sourceBlockName: block.name,
            position: {
                x: stack.position.x,
                y: currentStackHeight ?? 0,
                z: stack.position.z,
            },
            radius: animalPickupDisturbanceRadius,
        });
        pickupSound.play();
        triggerPickHaptic();
        spawn(
            resolveBlockParticleType(block.name),
            stack.position.clone().setY(currentStackHeight),
            4,
        );
        applyActivePreview(preview);
    }

    async function finishPickup(
        preview: ResolvedPlacementPreview | null,
        {
            hudDropRequested,
        }: {
            hudDropRequested: boolean;
        },
    ) {
        const garden = getCurrentGarden();
        const attachedPlacement = getAttachedPlacement(garden);
        const raisedBed = findRaisedBedByBlockId(garden, block.id);
        const movingSegments = getMovingSegments(garden);
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
                    position: stack.position,
                    blockIndex,
                    raisedBedId: raisedBed?.id,
                    attached: attachedPlacement
                        ? {
                              position: {
                                  x: attachedPlacement.candidateStack.position
                                      .x,
                                  z: attachedPlacement.candidateStack.position
                                      .z,
                              },
                              blockIndex: attachedPlacement.candidateBlockIndex,
                          }
                        : undefined,
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

        const previewDropPosition = stack.position
            .clone()
            .add(relative)
            .setY(preview.previewHoverHeight + currentStackHeight);

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
            spawn(resolveBlockParticleType(block.name), previewDropPosition, 8);
            const blockDataForInventory = getBlockDataByName(
                blocksData,
                block.name,
            );

            await storeBlockInGardenBox
                .mutateAsync({
                    sourcePosition: {
                        x: stack.position.x,
                        z: stack.position.z,
                    },
                    blockIndex,
                    sourceBlockId: block.id,
                    blockName: block.name,
                    blockEntityId: blockDataForInventory?.id.toString(),
                    blockLabel:
                        blockDataForInventory?.information?.label ?? block.name,
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
                    position: stack.position,
                    blockIndex,
                    raisedBedId: raisedBed?.id,
                    attached: attachedPlacement
                        ? {
                              position: {
                                  x: attachedPlacement.candidateStack.position
                                      .x,
                                  z: attachedPlacement.candidateStack.position
                                      .z,
                              },
                              blockIndex: attachedPlacement.candidateBlockIndex,
                          }
                        : undefined,
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
        spawn(resolveBlockParticleType(block.name), previewDropPosition, 8);

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
                pointerMoveCancelDistance(session.pointerType)
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
                ) <= pointerMoveCancelDistance(session.pointerType)
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

        clearSessionTimers(session);
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
            return;
        }

        event.preventDefault();
        suppressBlockInteractions(suppressClickAfterDragMs);
        const preview =
            resolvePlacementPreview(
                session.lastClientX,
                session.lastClientY,
                session.pickupAnchorOffset,
            ) ?? session.latestPreview;
        void finishPickup(preview, {
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

    function handlePickupPointerEnter(event: ThreeEvent<PointerEvent>) {
        if (blockIndex < 0 || !event.nativeEvent.shiftKey || !gameStateStore) {
            return false;
        }

        const gameState = gameStateStore.getState();
        const preview = gameState.activeDragPreview;
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

    function handlePointerDown(event: ThreeEvent<PointerEvent>) {
        if (event.button === 0 && handlePickupPointerEnter(event)) {
            return;
        }

        if (
            event.button !== 0 ||
            pointerSession.current ||
            areBlockInteractionsSuppressed() ||
            !getCurrentGarden() ||
            !blocksData ||
            blockIndex < 0
        ) {
            return;
        }

        event.stopPropagation();

        const nativeEvent = event.nativeEvent;
        const pickupAnchorOffset = {
            x: event.point.x - stack.position.x,
            y: event.point.y - (currentStackHeight ?? 0),
            z: event.point.z - stack.position.z,
        };
        const session: PointerSession = {
            pointerId: nativeEvent.pointerId,
            pointerType: nativeEvent.pointerType,
            startClientX: nativeEvent.clientX,
            startClientY: nativeEvent.clientY,
            lastClientX: nativeEvent.clientX,
            lastClientY: nativeEvent.clientY,
            pickupClientX: null,
            pickupClientY: null,
            pickupAnchorOffset,
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

    useBlockInteractionTargetRegistration(
        noControl ? undefined : interactionTargetKey,
        {
            block,
            blockIndex,
            stack,
        },
        {
            onClick: handleClick,
            onPickupPointerEnter: handlePickupPointerEnter,
            onPointerDown: handlePointerDown,
        },
    );

    const isGroupedPreviewBlocked =
        isPreviewTarget && (activeDragPreview?.isBlocked ?? false);
    const showBlockedIndicator = isBlocked || isGroupedPreviewBlocked;
    const blockedScaleSprings = useSpring({
        scale: showBlockedIndicator ? 1 : 0,
        opacity: showBlockedIndicator ? 1 : 0,
        config: {
            tension: 350,
        },
    });
    const showPickupOutline = pickupOutlineVisible || isPreviewTarget;
    const indicatorPosition: [number, number, number] = [
        stack.position.x,
        currentStackHeight,
        stack.position.z,
    ];
    const recyclePosition: [number, number, number] = [
        stack.position.x,
        currentStackHeight + 0.2,
        stack.position.z,
    ];

    if (noControl) {
        return <>{children}</>;
    }

    const pickupOutlineContent = renderPickupOutline ? (
        <HoverOutline {...blockPickupOutlineStyle} hovered={showPickupOutline}>
            {children}
        </HoverOutline>
    ) : (
        children
    );
    const dragPosition = dragSprings.internalPosition as unknown as [
        number,
        number,
        number,
    ];
    const blockedIndicator = showBlockedIndicator ? (
        <animated.group
            scale={blockedScaleSprings.scale}
            position={indicatorPosition}
        >
            <Shadow color={0xff0000} opacity={1} colorStop={0.5} scale={2} />
        </animated.group>
    ) : null;
    const recycleIndicator = isOverRecycler ? (
        <Suspense>
            <animated.group position={recyclePosition}>
                <RecycleIndicator />
            </animated.group>
        </Suspense>
    ) : null;

    if (interactionTargetKey) {
        return (
            <>
                {pickupOutlineContent}
                {(blockedIndicator || recycleIndicator) && (
                    <animated.group
                        position={dragPosition}
                        scale={dragSprings.scale}
                    >
                        {blockedIndicator}
                        {recycleIndicator}
                    </animated.group>
                )}
            </>
        );
    }

    return (
        <animated.group
            position={dragPosition}
            scale={dragSprings.scale}
            onPointerEnter={handlePickupPointerEnter}
            onPointerDown={handlePointerDown}
            onClick={handleClick}
        >
            {blockedIndicator}
            {pickupOutlineContent}
            {recycleIndicator}
        </animated.group>
    );
}
