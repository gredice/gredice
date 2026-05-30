'use client';

import { animated, useSpring } from '@react-spring/three';
import { Billboard, Shadow, useTexture } from '@react-three/drei';
import { type ThreeEvent, useThree } from '@react-three/fiber';
import {
    type PropsWithChildren,
    Suspense,
    useEffect,
    useRef,
    useState,
} from 'react';
import { Plane, Raycaster, Vector2, Vector3 } from 'three';
import {
    activeDragPreviewTargetMatches,
    createActiveDragPreviewTarget,
} from '../dragPreviewIdentity';
import { useBlockData } from '../hooks/useBlockData';
import { useBlockMove } from '../hooks/useBlockMove';
import { useBlockRecycle } from '../hooks/useBlockRecycle';
import { useCurrentGarden } from '../hooks/useCurrentGarden';
import { useGardenBoxStoreBlock } from '../hooks/useGardenBoxStoreBlock';
import {
    resolveBlockParticleType,
    useParticles,
} from '../particles/ParticleSystem';
import type { EntityInstanceProps } from '../types/runtime/EntityInstanceProps';
import { useGameState } from '../useGameState';
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

type PickableGroupProps = PropsWithChildren<
    Pick<EntityInstanceProps, 'stack' | 'block'> & { noControl?: boolean }
>;

type PlacementPreview = {
    blockId: string;
    blockName: string;
    blockUnderId: string | null;
    blockUnderName: string | null;
    destination: {
        x: number;
        z: number;
    };
    destinationIndex: number;
    hoverHeight: number;
    isRecycler: boolean;
    isBlocked: boolean;
};

type ResolvedPlacementPreview = {
    relative: Vector3;
    previewHoverHeight: number;
    sourceHoverHeight: number;
    hoveredGardenBoxBlockId: string | null;
    canStoreInGardenBox: boolean;
    nextIsOverRecycler: boolean;
    nextIsBlocked: boolean;
};

type PointerSession = {
    pointerId: number;
    pointerType: string;
    startClientX: number;
    startClientY: number;
    lastClientX: number;
    lastClientY: number;
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

export function PickableGroup({
    children,
    stack,
    block,
    noControl,
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
    const activeDragPreview = useGameState(
        (state) => state.activeDragPreview ?? null,
    );
    const setActiveDragPreview = useGameState(
        (state) => state.setActiveDragPreview,
    );

    const [isBlocked, setIsBlocked] = useState(false);
    const [isOverRecycler, setIsOverRecycler] = useState(false);
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
    const activePreviewTarget = createActiveDragPreviewTarget({
        blockId: block.id,
        blockIndex,
        stackPosition: stack.position,
    });
    const attachedPreviewTarget = attachedPlacement
        ? createActiveDragPreviewTarget({
              blockId: attachedPlacement.candidateBlock.id,
              blockIndex: attachedPlacement.candidateBlockIndex,
              stackPosition: attachedPlacement.candidateStack.position,
          })
        : null;

    const isPreviewSource = activeDragPreviewTargetMatches(
        activeDragPreview?.source,
        activePreviewTarget,
    );
    const isPreviewAttached = activeDragPreviewTargetMatches(
        activeDragPreview?.attached,
        activePreviewTarget,
    );
    const wasPreviewAttached = useRef(false);
    const shouldResetAttachedOnPreviewEnd = useRef(false);
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

        if (isPreviewAttached && activeDragPreview) {
            wasPreviewAttached.current = true;
            shouldResetAttachedOnPreviewEnd.current =
                activeDragPreview.isBlocked;
            dragSpringsApi.start({
                internalPosition: [
                    activeDragPreview.relative.x,
                    activeDragPreview.attachedHoverHeight + pickupLift,
                    activeDragPreview.relative.z,
                ],
            });
            return;
        }

        if (!activeDragPreview && wasPreviewAttached.current) {
            wasPreviewAttached.current = false;
            if (shouldResetAttachedOnPreviewEnd.current) {
                dragSpringsApi.start({ internalPosition: [0, 0, 0], scale: 1 });
            }
            shouldResetAttachedOnPreviewEnd.current = false;
        }
    }, [activeDragPreview, isPreviewAttached, isPreviewSource, dragSpringsApi]);

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

    function resolvePlacementPreview(
        clientX: number,
        clientY: number,
    ): ResolvedPlacementPreview | null {
        if (!garden || !blocksData || blockIndex < 0) {
            return null;
        }

        const rect = domElement.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) {
            return null;
        }

        const { pt, dest, relative } = dragState.current;
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

        dest.set(pt.x, 0, pt.z).round();
        relative.set(dest.x - stack.position.x, 0, dest.z - stack.position.z);

        const movingPlacements = [
            {
                blockId: block.id,
                blockName: block.name,
                sourceStack: stack,
                currentHeight: currentStackHeight ?? 0,
                canRecycle,
            },
            ...(attachedPlacement
                ? [
                      {
                          blockId: attachedPlacement.candidateBlock.id,
                          blockName: attachedPlacement.candidateBlock.name,
                          sourceStack: attachedPlacement.candidateStack,
                          currentHeight: attachedCurrentStackHeight,
                          canRecycle: false,
                      },
                  ]
                : []),
        ];
        const movingBlockIds = new Set(
            movingPlacements.map((placement) => placement.blockId),
        );

        const placementPreviews: PlacementPreview[] = movingPlacements.map(
            (placement) => {
                const destination = {
                    x: placement.sourceStack.position.x + relative.x,
                    z: placement.sourceStack.position.z + relative.z,
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
                    placement.canRecycle &&
                    (blockUnderData?.functions?.recycler ?? false);
                const isStackable =
                    blockUnderData?.attributes?.stackable ?? true;
                const hoverHeight =
                    getStackHeight(blocksData, destinationWithoutMoving) -
                    placement.currentHeight;

                return {
                    blockId: placement.blockId,
                    blockName: placement.blockName,
                    blockUnderId: blockUnder?.id ?? null,
                    blockUnderName: blockUnder?.name ?? null,
                    destination,
                    destinationIndex: destinationBlocks.length,
                    hoverHeight,
                    isRecycler,
                    isBlocked: !isStackable && !isRecycler,
                };
            },
        );

        const movedRaisedBedPreviewByPosition = new Map(
            placementPreviews
                .filter((preview) => preview.blockName === 'Raised_Bed')
                .map((preview) => [
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

        const raisedBedPlacementBlocked = placementPreviews
            .filter((preview) => preview.blockName === 'Raised_Bed')
            .some((preview) => {
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
                    if (
                        movedNeighbor &&
                        movedNeighbor.blockName === 'Raised_Bed'
                    ) {
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
                    ...placementPreviews
                        .filter(
                            (candidatePreview) =>
                                candidatePreview.blockName === 'Raised_Bed',
                        )
                        .map(
                            (candidatePreview) =>
                                `${candidatePreview.destination.x}|${candidatePreview.destination.z}`,
                        ),
                ]);

                return hasExternalRaisedBedNeighbor(
                    externalNeighbor.x,
                    externalNeighbor.z,
                    excludedPositions,
                );
            });

        const sourcePreview = placementPreviews[0];
        if (!sourcePreview) {
            return null;
        }

        const attachedPreview = attachedPlacement
            ? placementPreviews.find(
                  (preview) =>
                      preview.blockId === attachedPlacement.candidateBlock.id,
              )
            : null;
        const sourceHoverHeight = sourcePreview.hoverHeight;
        const attachedHoverHeight = attachedPreview?.hoverHeight ?? 0;
        const previewHoverHeight = Math.max(
            sourceHoverHeight,
            attachedHoverHeight,
        );
        const hoveredGardenBoxBlockId =
            placementPreviews.find(
                (preview) => preview.blockUnderName === 'GardenBox',
            )?.blockUnderId ?? null;
        const canStoreInGardenBox =
            hoveredGardenBoxBlockId !== null &&
            block.name !== 'GardenBox' &&
            block.name !== 'Raised_Bed' &&
            attachedPlacement === null;
        const heightsMismatch =
            attachedPlacement !== null &&
            Math.abs(sourceHoverHeight - attachedHoverHeight) > 0.0001;
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
            sourceHoverHeight,
            hoveredGardenBoxBlockId,
            canStoreInGardenBox,
            nextIsOverRecycler,
            nextIsBlocked,
        };
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
        setIsBlocked(false);
        setIsOverRecycler(false);
        setPickupBlock(null);
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
            attached: attachedPreviewTarget,
            hoveredGardenBoxBlockId: preview.hoveredGardenBoxBlockId,
            relative: {
                x: preview.relative.x,
                z: preview.relative.z,
            },
            sourceHoverHeight: preview.sourceHoverHeight,
            attachedHoverHeight: preview.previewHoverHeight,
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

        const preview = resolvePlacementPreview(
            session.lastClientX,
            session.lastClientY,
        );
        if (!preview) {
            cancelPointerSession(true);
            return;
        }

        session.activated = true;
        session.latestPreview = preview;
        setIsDragging(false);
        setPickupBlock(block);
        pickupSound.play();
        triggerPickHaptic();
        spawn(
            resolveBlockParticleType(block.name),
            stack.position.clone().setY(currentStackHeight),
            6,
        );
        applyActivePreview(preview);
    }

    async function finishPickup(preview: ResolvedPlacementPreview | null) {
        resetPickupVisualState();

        if (!preview || preview.nextIsBlocked) {
            dragSpringsApi.start({ internalPosition: [0, 0, 0], scale: 1 });
            return;
        }

        const relative = preview.relative;
        const previewDropPosition = stack.position
            .clone()
            .add(relative)
            .setY(preview.previewHoverHeight + currentStackHeight);

        if (preview.canStoreInGardenBox && preview.hoveredGardenBoxBlockId) {
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

            await storeBlockInGardenBox.mutateAsync({
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
            });
            return;
        }

        if (preview.nextIsOverRecycler) {
            dragSpringsApi.start({
                internalPosition: [relative.x, -1.5, relative.z],
                scale: 0.1,
            });
            triggerPlaceHaptic();
            await recycleBlock.mutateAsync({
                position: stack.position,
                blockIndex,
                raisedBedId: raisedBed?.id,
                attached: attachedPlacement
                    ? {
                          position: {
                              x: attachedPlacement.candidateStack.position.x,
                              z: attachedPlacement.candidateStack.position.z,
                          },
                          blockIndex: attachedPlacement.candidateBlockIndex,
                      }
                    : undefined,
            });
            return;
        }

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
        const sourcePosition = {
            x: stack.position.x,
            z: stack.position.z,
        };
        const destinationPosition = {
            x: stack.position.x + relative.x,
            z: stack.position.z + relative.z,
        };

        await moveBlock.mutateAsync({
            sourcePosition,
            destinationPosition,
            blockIndex,
            sourceBlockId: block.id,
            attached: attachedPlacement
                ? {
                      sourcePosition: {
                          x: attachedPlacement.candidateStack.position.x,
                          z: attachedPlacement.candidateStack.position.z,
                      },
                      destinationPosition: {
                          x:
                              attachedPlacement.candidateStack.position.x +
                              relative.x,
                          z:
                              attachedPlacement.candidateStack.position.z +
                              relative.z,
                      },
                      blockIndex: attachedPlacement.candidateBlockIndex,
                      sourceBlockId: attachedPlacement.candidateBlock.id,
                  }
                : undefined,
        });
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
        const preview = resolvePlacementPreview(event.clientX, event.clientY);
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
            return;
        }

        event.preventDefault();
        suppressBlockInteractions(suppressClickAfterDragMs);
        const preview =
            session.latestPreview ??
            resolvePlacementPreview(session.lastClientX, session.lastClientY);
        void finishPickup(preview);
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

        const nativeEvent = event.nativeEvent;
        const session: PointerSession = {
            pointerId: nativeEvent.pointerId,
            pointerType: nativeEvent.pointerType,
            startClientX: nativeEvent.clientX,
            startClientY: nativeEvent.clientY,
            lastClientX: nativeEvent.clientX,
            lastClientY: nativeEvent.clientY,
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
        (isPreviewSource || isPreviewAttached) &&
        (activeDragPreview?.isBlocked ?? false);
    const showBlockedIndicator = isBlocked || isGroupedPreviewBlocked;
    const showValidIndicator =
        (isPreviewSource || isPreviewAttached) &&
        Boolean(activeDragPreview) &&
        !showBlockedIndicator;
    const blockedScaleSprings = useSpring({
        scale: showBlockedIndicator ? 1 : 0,
        opacity: showBlockedIndicator ? 1 : 0,
        config: {
            tension: 350,
        },
    });
    const validScaleSprings = useSpring({
        scale: showValidIndicator ? 1 : 0,
        opacity: showValidIndicator ? 0.65 : 0,
        config: {
            tension: 350,
        },
    });
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
                scale={validScaleSprings.scale}
                position={indicatorPosition}
            >
                <Shadow
                    color="#22c55e"
                    opacity={0.65}
                    colorStop={0.45}
                    scale={1.8}
                />
            </animated.group>
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
            {children}
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
