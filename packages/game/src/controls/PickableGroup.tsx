'use client';

import { animated, useSpring } from '@react-spring/three';
import { Billboard, Shadow, useTexture } from '@react-three/drei';
import { type ThreeEvent, useThree } from '@react-three/fiber';
import {
    type PropsWithChildren,
    Suspense,
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import { Plane, Raycaster, Vector2, Vector3 } from 'three';
import {
    type ActiveDragPreviewTarget,
    type ActiveDragPreviewTargetOffset,
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
import { useCurrentGarden } from '../hooks/useCurrentGarden';
import { useGardenBoxStoreBlock } from '../hooks/useGardenBoxStoreBlock';
import {
    resolveBlockParticleType,
    useParticles,
} from '../particles/ParticleSystem';
import { isPointOverSandboxBlockTrashDropTarget } from '../sandboxBlockTrashDropTarget';
import type { EntityInstanceProps } from '../types/runtime/EntityInstanceProps';
import type { Stack } from '../types/Stack';
import { type ActiveDragPreview, useGameState } from '../useGameState';
import {
    getBlockDataByName,
    getStackHeight,
    useStackHeight,
} from '../utils/getStackHeight';
import { triggerPickHaptic, triggerPlaceHaptic } from '../utils/haptics';
import {
    findAttachedRaisedBedBlockId,
    findRaisedBedByBlockId,
} from '../utils/raisedBedBlocks';
import {
    areBlockInteractionsSuppressed,
    suppressBlockInteractions,
} from './blockInteractionSuppression';

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
        noControl?: boolean;
        renderPickupOutline?: boolean;
    }
>;

type PlacementPreview = {
    blockUnderId: string | null;
    blockUnderName: string | null;
    destination: {
        x: number;
        z: number;
    };
    hoverHeight: number;
    isRecycler: boolean;
    isBlocked: boolean;
    segment: MovingSegment;
};

type ResolvedPlacementPreview = {
    relative: Vector3;
    previewHoverHeight: number;
    hoveredGardenBoxBlockId: string | null;
    canStoreInGardenBox: boolean;
    nextIsOverRecycler: boolean;
    nextIsBlocked: boolean;
    targetOffsets: ActiveDragPreviewTargetOffset[];
};

type MovingSegment = {
    sourceStack: Stack;
    sourceStartIndex: number;
    blocks: Stack['blocks'];
    baseHeight: number;
    canRecycle: boolean;
};

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

export function PickableGroup({
    children,
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
    const { data: garden } = useCurrentGarden();
    const { data: blocksData } = useBlockData();
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
    const setIsDragging = useGameState((state) => state.setIsDragging);
    const pickupSound = effectsAudioMixer.useSoundEffect(
        'https://cdn.gredice.com/sounds/effects/Pick Grass 01.mp3',
    );
    const dropSound = effectsAudioMixer.useSoundEffect(
        'https://cdn.gredice.com/sounds/effects/Drop Grass 01.mp3',
    );

    const setPickupBlock = useGameState((state) => state.setPickupBlock);
    const disturbAnimals = useGameState((state) => state.disturbAnimals);
    const setActiveDragPreview = useGameState(
        (state) => state.setActiveDragPreview,
    );
    const setStationaryPickupOutlineTarget = useGameState(
        (state) => state.setStationaryPickupOutlineTarget,
    );
    const setSandboxBlockTrashDropTargetActive = useGameState(
        (state) => state.setSandboxBlockTrashDropTargetActive,
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

    const raisedBed = findRaisedBedByBlockId(garden, block.id);
    const canRecycleRaisedBed = (raisedBed?.status ?? 'new') === 'new';
    const canRecycle = canRecycleRaisedBed;

    const attachedRaisedBedBlockId =
        block.name === 'Raised_Bed' && garden
            ? findAttachedRaisedBedBlockId(garden.stacks, block.id)
            : null;
    const attachedPlacement = attachedRaisedBedBlockId
        ? garden?.stacks
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
                      candidate.candidateBlock.id === attachedRaisedBedBlockId,
              )
        : null;
    const attachedCurrentStackHeight = attachedPlacement
        ? getStackHeight(
              blocksData,
              attachedPlacement.candidateStack,
              attachedPlacement.candidateBlock,
          )
        : 0;
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
            pointerSessionCleanup.current?.();
            pointerSessionCleanup.current = null;
        };
    }, []);

    function getStack(destination: { x: number; z: number }) {
        return garden?.stacks.find(
            (candidate) =>
                candidate.position.x === destination.x &&
                candidate.position.z === destination.z,
        );
    }

    function getMovingSegments(): MovingSegment[] {
        if (blockIndex < 0) {
            return [];
        }

        const sourceBlocks = stack.blocks.slice(blockIndex);
        if (sourceBlocks.length === 0) {
            return [];
        }

        const attachedBlocks = attachedPlacement
            ? attachedPlacement.candidateStack.blocks.slice(
                  attachedPlacement.candidateBlockIndex,
              )
            : [];
        const canRecycleSelection =
            canRecycle &&
            sourceBlocks.length === 1 &&
            (!attachedPlacement || attachedBlocks.length === 1);

        return [
            {
                sourceStack: stack,
                sourceStartIndex: blockIndex,
                blocks: sourceBlocks,
                baseHeight: currentStackHeight ?? 0,
                canRecycle: canRecycleSelection,
            },
            ...(attachedPlacement && attachedBlocks.length > 0
                ? [
                      {
                          sourceStack: attachedPlacement.candidateStack,
                          sourceStartIndex:
                              attachedPlacement.candidateBlockIndex,
                          blocks: attachedBlocks,
                          baseHeight: attachedCurrentStackHeight,
                          canRecycle: false,
                      },
                  ]
                : []),
        ];
    }

    function createTargetOffsets(
        placementPreviews: PlacementPreview[],
        hoverHeight: number,
    ): ActiveDragPreviewTargetOffset[] {
        return placementPreviews.flatMap((preview) =>
            preview.segment.blocks.map((segmentBlock, segmentBlockOffset) => ({
                ...createActiveDragPreviewTarget({
                    blockId: segmentBlock.id,
                    blockIndex:
                        preview.segment.sourceStartIndex + segmentBlockOffset,
                    stackPosition: preview.segment.sourceStack.position,
                }),
                hoverHeight,
            })),
        );
    }

    function resolvePlacementPreviewForRelative(relative: Vector3) {
        if (!garden || !blocksData || blockIndex < 0) {
            return null;
        }

        const movingSegments = getMovingSegments();
        if (movingSegments.length === 0) {
            return null;
        }
        const movingBlockIds = new Set(
            movingSegments.flatMap((segment) =>
                segment.blocks.map((segmentBlock) => segmentBlock.id),
            ),
        );

        const placementPreviews: PlacementPreview[] = movingSegments.flatMap(
            (segment) => {
                if (!segment.blocks[0]) {
                    return [];
                }

                const destination = {
                    x: segment.sourceStack.position.x + relative.x,
                    z: segment.sourceStack.position.z + relative.z,
                };
                const destinationStack = getStack(destination);
                const destinationBlocks =
                    destinationStack?.blocks.filter(
                        (candidate) => !movingBlockIds.has(candidate.id),
                    ) ?? [];
                const destinationWithoutMoving = destinationStack
                    ? {
                          ...destinationStack,
                          blocks: destinationBlocks,
                      }
                    : undefined;
                const blockUnder = destinationBlocks.at(-1);
                const blockUnderData = blockUnder
                    ? getBlockDataByName(blocksData, blockUnder.name)
                    : null;
                const isRecycler =
                    segment.canRecycle &&
                    blockUnder?.name !== 'Composter' &&
                    (blockUnderData?.functions?.recycler ?? false);
                const isStackable =
                    blockUnderData?.attributes?.stackable ?? true;
                const hoverHeight =
                    getStackHeight(blocksData, destinationWithoutMoving) -
                    segment.baseHeight;

                return [
                    {
                        blockUnderId: blockUnder?.id ?? null,
                        blockUnderName: blockUnder?.name ?? null,
                        destination,
                        hoverHeight,
                        isRecycler,
                        isBlocked: !isStackable && !isRecycler,
                        segment,
                    },
                ];
            },
        );

        const movedRaisedBedPreviews = placementPreviews.filter((preview) =>
            preview.segment.blocks.some(
                (segmentBlock) => segmentBlock.name === 'Raised_Bed',
            ),
        );
        const movedRaisedBedPreviewByPosition = new Map(
            movedRaisedBedPreviews.map((preview) => [
                `${preview.destination.x}|${preview.destination.z}`,
                preview,
            ]),
        );

        function getExternalRaisedBedBlockAtPosition(x: number, z: number) {
            const stackAtPosition = getStack({ x, z });
            const candidateBlocks =
                stackAtPosition?.blocks.filter(
                    (candidate) => !movingBlockIds.has(candidate.id),
                ) ?? [];

            for (
                let candidateIndex = candidateBlocks.length - 1;
                candidateIndex >= 0;
                candidateIndex--
            ) {
                const candidateBlock = candidateBlocks[candidateIndex];
                if (candidateBlock?.name === 'Raised_Bed') {
                    return candidateBlock;
                }
            }

            return null;
        }

        function hasExternalRaisedBedNeighbor(
            x: number,
            z: number,
            excludedPositions: Set<string>,
        ) {
            const neighbors = [
                { x: x - 1, z },
                { x: x + 1, z },
                { x, z: z - 1 },
                { x, z: z + 1 },
            ];

            return neighbors.some((neighbor) => {
                if (excludedPositions.has(`${neighbor.x}|${neighbor.z}`)) {
                    return false;
                }

                return Boolean(
                    getExternalRaisedBedBlockAtPosition(neighbor.x, neighbor.z),
                );
            });
        }

        const raisedBedPlacementBlocked = movedRaisedBedPreviews.some(
            (preview) => {
                const neighbors = [
                    { x: preview.destination.x - 1, z: preview.destination.z },
                    { x: preview.destination.x + 1, z: preview.destination.z },
                    { x: preview.destination.x, z: preview.destination.z - 1 },
                    { x: preview.destination.x, z: preview.destination.z + 1 },
                ];

                let raisedBedNeighborCount = 0;
                let externalNeighbor:
                    | {
                          x: number;
                          z: number;
                      }
                    | undefined;

                for (const neighbor of neighbors) {
                    const movedNeighbor = movedRaisedBedPreviewByPosition.get(
                        `${neighbor.x}|${neighbor.z}`,
                    );
                    if (movedNeighbor) {
                        raisedBedNeighborCount += 1;
                        continue;
                    }

                    const externalNeighborBlock =
                        getExternalRaisedBedBlockAtPosition(
                            neighbor.x,
                            neighbor.z,
                        );
                    if (externalNeighborBlock) {
                        raisedBedNeighborCount += 1;
                        externalNeighbor = {
                            x: neighbor.x,
                            z: neighbor.z,
                        };
                    }
                }

                if (raisedBedNeighborCount > 1) {
                    return true;
                }

                if (!externalNeighbor) {
                    return false;
                }

                const excludedPositions = new Set<string>([
                    `${preview.destination.x}|${preview.destination.z}`,
                    ...movedRaisedBedPreviews.map(
                        (candidatePreview) =>
                            `${candidatePreview.destination.x}|${candidatePreview.destination.z}`,
                    ),
                ]);

                return hasExternalRaisedBedNeighbor(
                    externalNeighbor.x,
                    externalNeighbor.z,
                    excludedPositions,
                );
            },
        );

        const sourcePreview = placementPreviews[0];
        if (!sourcePreview) {
            return null;
        }

        const sourceHoverHeight = sourcePreview.hoverHeight;
        const previewHoverHeight = Math.max(
            ...placementPreviews.map((preview) => preview.hoverHeight),
        );
        const hoveredGardenBoxBlockId =
            placementPreviews.find(
                (preview) => preview.blockUnderName === 'GardenBox',
            )?.blockUnderId ?? null;
        const canStoreInGardenBox =
            !localSandboxStorageKey &&
            !garden.isSandbox &&
            hoveredGardenBoxBlockId !== null &&
            sourcePreview.segment.blocks.length === 1 &&
            sourcePreview.segment.blocks[0]?.name !== 'GardenBox' &&
            sourcePreview.segment.blocks[0]?.name !== 'Raised_Bed' &&
            placementPreviews.length === 1;
        const heightsMismatch = placementPreviews.some(
            (preview) =>
                Math.abs(sourceHoverHeight - preview.hoverHeight) > 0.0001,
        );
        const nextIsOverRecycler = sourcePreview.isRecycler;
        const nextIsBlocked = nextIsOverRecycler
            ? false
            : canStoreInGardenBox
              ? false
              : placementPreviews.some((preview) => preview.isBlocked) ||
                heightsMismatch ||
                raisedBedPlacementBlocked;

        return {
            relative: relative.clone(),
            previewHoverHeight,
            hoveredGardenBoxBlockId,
            canStoreInGardenBox,
            nextIsOverRecycler,
            nextIsBlocked,
            targetOffsets: createTargetOffsets(
                placementPreviews,
                previewHoverHeight,
            ),
        };
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

    function resolvePlacementPreviewAtDestination(destination: {
        x: number;
        z: number;
    }) {
        const { relative } = dragState.current;
        relative.set(
            destination.x - stack.position.x,
            0,
            destination.z - stack.position.z,
        );
        return resolvePlacementPreviewForRelative(relative);
    }

    function resolvePlacementPreview(
        clientX: number,
        clientY: number,
        pickupAnchorOffset: PickupAnchorOffset,
    ): ResolvedPlacementPreview | null {
        if (!garden || !blocksData || blockIndex < 0) {
            return null;
        }

        const rect = domElement.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) {
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
            const preview =
                resolvePlacementPreviewAtDestination(candidateDestination);
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
        setSandboxBlockTrashDropTargetActive(false);
    }

    function isPointerOverSandboxTrash(clientX: number, clientY: number) {
        return (
            Boolean(garden?.isSandbox) &&
            isPointOverSandboxBlockTrashDropTarget(clientX, clientY)
        );
    }

    function createActivePreviewResetQueue() {
        let resetQueued = false;

        return {
            queue: () => {
                if (resetQueued) {
                    return;
                }

                resetQueued = true;
                window.requestAnimationFrame(() => {
                    setActiveDragPreview(null);
                });
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
        pointerSession.current = null;
        cleanupPointerSessionListeners();
        setPickupOutlineVisible(false);
        setSandboxBlockTrashDropTargetActive(false);
        if (resetSpring) {
            dragSpringsApi.start({ internalPosition: [0, 0, 0], scale: 1 });
        }
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
            6,
        );
        applyActivePreview(preview);
    }

    async function finishPickup(
        preview: ResolvedPlacementPreview | null,
        deleteRequested: boolean,
    ) {
        const blockIdsToDelete = deleteRequested
            ? getMovingSegments().flatMap((segment) =>
                  segment.blocks.map((segmentBlock) => segmentBlock.id),
              )
            : [];

        if (deleteRequested) {
            resetPickupVisualState();
            if (blockIdsToDelete.length === 0) {
                dragSpringsApi.start({
                    internalPosition: [0, 0, 0],
                    scale: 1,
                });
                return;
            }

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
            spawn(
                resolveBlockParticleType(block.name),
                previewDropPosition,
                12,
            );
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

        const moveRequests = getMovingSegments().flatMap((segment) =>
            segment.blocks.map((segmentBlock) => ({
                sourcePosition: {
                    x: segment.sourceStack.position.x,
                    z: segment.sourceStack.position.z,
                },
                destinationPosition: {
                    x: segment.sourceStack.position.x + relative.x,
                    z: segment.sourceStack.position.z + relative.z,
                },
                blockIndex: segment.sourceStartIndex,
                sourceBlockId: segmentBlock.id,
            })),
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
        spawn(resolveBlockParticleType(block.name), previewDropPosition, 12);

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
        }

        setSandboxBlockTrashDropTargetActive(
            isPointerOverSandboxTrash(event.clientX, event.clientY),
        );

        const preview = resolvePlacementPreview(
            event.clientX,
            event.clientY,
            session.pickupAnchorOffset,
        );
        if (!preview) {
            return;
        }

        session.latestPreview = preview;
        applyActivePreview(preview);
    }

    function handleWindowPointerUp(event: PointerEvent) {
        const session = pointerSession.current;
        if (!session || event.pointerId !== session.pointerId) {
            return;
        }

        clearSessionTimers(session);
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
            session.latestPreview ??
            resolvePlacementPreview(
                session.lastClientX,
                session.lastClientY,
                session.pickupAnchorOffset,
            );
        void finishPickup(
            preview,
            isPointerOverSandboxTrash(session.lastClientX, session.lastClientY),
        );
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

    function handlePointerDown(event: ThreeEvent<PointerEvent>) {
        if (
            event.button !== 0 ||
            pointerSession.current ||
            areBlockInteractionsSuppressed() ||
            !garden ||
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

    return (
        <animated.group
            position={
                dragSprings.internalPosition as unknown as [
                    number,
                    number,
                    number,
                ]
            }
            scale={dragSprings.scale}
            onPointerDown={handlePointerDown}
            onClick={handleClick}
        >
            <animated.group
                scale={blockedScaleSprings.scale}
                position={indicatorPosition}
            >
                <Shadow
                    color={0xff0000}
                    opacity={1}
                    colorStop={0.5}
                    scale={2}
                />
            </animated.group>
            {pickupOutlineContent}
            {isOverRecycler && (
                <Suspense>
                    <animated.group position={recyclePosition}>
                        <RecycleIndicator />
                    </animated.group>
                </Suspense>
            )}
        </animated.group>
    );
}
