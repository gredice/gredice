'use client';

import { animated, useSpring } from '@react-spring/three';
import { Billboard, Shadow, useTexture } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { type Handler, useDrag } from '@use-gesture/react';
import {
    type PointerEvent,
    type PropsWithChildren,
    Suspense,
    useEffect,
    useRef,
    useState,
} from 'react';
import { Plane, Raycaster, Vector2, Vector3 } from 'three';
import { useBlockData } from '../hooks/useBlockData';
import { useBlockMove } from '../hooks/useBlockMove';
import { useBlockRecycle } from '../hooks/useBlockRecycle';
import { useCurrentGarden } from '../hooks/useCurrentGarden';
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

const groundPlane = new Plane(new Vector3(0, 1, 0), 0);

type PickableGroupProps = PropsWithChildren<
    Pick<EntityInstanceProps, 'stack' | 'block'> & { noControl?: boolean }
>;

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
    const getStack = ({ x, z }: { x: number; z: number }) => {
        return garden?.stacks.find(
            (stack) => stack.position.x === x && stack.position.z === z,
        );
    };
    const camera = useThree((state) => state.camera);
    const gl = useThree((state) => state.gl);
    const { domElement } = gl;
    const dragState = useRef({
        pt: new Vector3(),
        dest: new Vector3(),
        relative: new Vector3(),
    });
    const currentStackHeight = useStackHeight(stack, block);
    const didDrag = useRef(false);

    const effectsAudioMixer = useGameState((state) => state.audio.effects);
    const pickupSound = effectsAudioMixer.useSoundEffect(
        'https://cdn.gredice.com/sounds/effects/Pick Grass 01.mp3',
    );
    const dropSound = effectsAudioMixer.useSoundEffect(
        block.name === 'Block_Grass'
            ? 'https://cdn.gredice.com/sounds/effects/Drop Grass 01.mp3'
            : 'https://cdn.gredice.com/sounds/effects/Drop Grass 01.mp3',
    );

    // Pickup system
    const pickupBlock = useGameState((state) => state.pickupBlock);
    const setPickupBlock = useGameState((state) => state.setPickupBlock);
    const activeDragPreview = useGameState(
        (state) => state.activeDragPreview ?? null,
    );
    const setActiveDragPreview = useGameState(
        (state) => state.setActiveDragPreview ?? (() => {}),
    );

    // Block mechanic
    const [isBlocked, setIsBlocked] = useState(false);
    const moveBlock = useBlockMove();

    // Recycle block functionality
    const [isOverRecycler, setIsOverRecycler] = useState(false);
    const recycleBlock = useBlockRecycle();
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

    const isPreviewSource = activeDragPreview?.sourceBlockId === block.id;
    const isPreviewAttached = activeDragPreview?.attachedBlockId === block.id;
    const wasPreviewAttached = useRef(false);
    const shouldResetAttachedOnPreviewEnd = useRef(false);
    const previousStackPosition = useRef({
        x: stack.position.x,
        z: stack.position.z,
    });

    // Reset visual state after authoritative stack position changes
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

    const isDraggingWorld = useGameState((state) => state.isDragging);
    useEffect(() => {
        if (isDraggingWorld) {
            dragSpringsApi.start({ internalPosition: [0, 0, 0] });
            setIsBlocked(false);
            setIsOverRecycler(false);
            setActiveDragPreview(null);
            if (pickupBlock?.id === block.id) {
                setPickupBlock(null);
            }
        }
    }, [
        isDraggingWorld,
        block.id,
        pickupBlock?.id,
        setPickupBlock,
        setActiveDragPreview,
        dragSpringsApi,
    ]);

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
                    activeDragPreview.attachedHoverHeight + 0.1,
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

    const rect = domElement.getClientRects()[0];

    const dragHandler: Handler<'drag', unknown> = async ({
        pressed,
        event,
        xy: [x, y],
    }) => {
        if (isDraggingWorld) {
            return;
        }

        if (
            typeof event === 'object' &&
            event !== null &&
            'stopPropagation' in event &&
            typeof event.stopPropagation === 'function'
        ) {
            event.stopPropagation();
        }

        const { pt, dest, relative } = dragState.current;
        pt.set(
            ((x - rect.left) / rect.width) * 2 - 1,
            ((rect.top - y) / rect.height) * 2 + 1,
            0,
        );

        const raycaster = new Raycaster();
        raycaster.setFromCamera(new Vector2(pt.x, pt.y), camera);
        const isIntersecting = raycaster.ray.intersectPlane(groundPlane, pt);
        if (!isIntersecting) {
            return;
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

        const placementPreviews = movingPlacements.map((placement) => {
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
            const isStackable = blockUnderData?.attributes?.stackable ?? true;
            const hoverHeight =
                getStackHeight(blocksData, destinationWithoutMoving) -
                placement.currentHeight;

            return {
                blockId: placement.blockId,
                blockName: placement.blockName,
                destination,
                destinationIndex: destinationBlocks.length,
                hoverHeight,
                isRecycler,
                isBlocked: !isStackable && !isRecycler,
            };
        });

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
                          blockId: string;
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
                            blockId: externalNeighborBlock.id,
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
        const attachedPreview = attachedPlacement
            ? placementPreviews.find(
                  (preview) =>
                      preview.blockId === attachedPlacement.candidateBlock.id,
              )
            : null;
        const sourceHoverHeight = sourcePreview?.hoverHeight ?? 0;
        const attachedHoverHeight = attachedPreview?.hoverHeight ?? 0;
        const previewHoverHeight = Math.max(
            sourceHoverHeight,
            attachedHoverHeight,
        );
        const heightsMismatch =
            attachedPlacement !== null &&
            Math.abs(sourceHoverHeight - attachedHoverHeight) > 0.0001;
        const nextIsOverRecycler = sourcePreview?.isRecycler ?? false;
        const nextIsBlocked = nextIsOverRecycler
            ? false
            : placementPreviews.some((preview) => preview.isBlocked) ||
              heightsMismatch ||
              raisedBedPlacementBlocked;

        if (isOverRecycler !== nextIsOverRecycler) {
            setIsOverRecycler(nextIsOverRecycler);
        }
        if (nextIsBlocked !== isBlocked) {
            setIsBlocked(nextIsBlocked);
        }

        if (!pressed) {
            if (!didDrag.current) {
                return;
            }
            didDrag.current = false;
            setActiveDragPreview(null);
            setIsBlocked(false);
            setIsOverRecycler(false);

            if (pickupBlock?.id === block.id) {
                setPickupBlock(null);
            }

            if (nextIsBlocked) {
                // Revert to start position if released above blocked stack
                dragSpringsApi.start({ internalPosition: [0, 0, 0] });
            } else if (nextIsOverRecycler) {
                dragSpringsApi.start({
                    internalPosition: [relative.x, -1.5, relative.z],
                    scale: 0.1,
                });
                triggerPlaceHaptic();
                await recycleBlock.mutateAsync({
                    position: stack.position,
                    blockIndex: stack.blocks.indexOf(block),
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
                });
            } else {
                dragSpringsApi.start({
                    internalPosition: [
                        relative.x,
                        previewHoverHeight,
                        relative.z,
                    ],
                });
                dropSound.play();
                triggerPlaceHaptic();
                spawn(
                    resolveBlockParticleType(block.name),
                    stack.position
                        .clone()
                        .add(relative)
                        .setY(previewHoverHeight + currentStackHeight),
                    12,
                );
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
                    blockIndex: stack.blocks.indexOf(block),
                    sourceBlockId: block.id,
                    attached: attachedPlacement
                        ? {
                              sourcePosition: {
                                  x: attachedPlacement.candidateStack.position
                                      .x,
                                  z: attachedPlacement.candidateStack.position
                                      .z,
                              },
                              destinationPosition: {
                                  x:
                                      attachedPlacement.candidateStack.position
                                          .x + relative.x,
                                  z:
                                      attachedPlacement.candidateStack.position
                                          .z + relative.z,
                              },
                              blockIndex: attachedPlacement.candidateBlockIndex,
                              sourceBlockId:
                                  attachedPlacement.candidateBlock.id,
                          }
                        : undefined,
                });
            }
        } else {
            if (!didDrag.current) {
                pickupSound.play();
                triggerPickHaptic();
                if (nextIsBlocked !== isBlocked) {
                    setIsBlocked(nextIsBlocked);
                }
                if (nextIsOverRecycler !== isOverRecycler) {
                    setIsOverRecycler(nextIsOverRecycler);
                }

                spawn(
                    resolveBlockParticleType(block.name),
                    stack.position.clone().setY(currentStackHeight),
                    6,
                );
            }
            setPickupBlock(block);
            didDrag.current = true;
            setActiveDragPreview({
                sourceBlockId: block.id,
                attachedBlockId: attachedPlacement?.candidateBlock.id ?? null,
                relative: {
                    x: relative.x,
                    z: relative.z,
                },
                sourceHoverHeight,
                attachedHoverHeight: previewHoverHeight,
                isBlocked: nextIsBlocked,
                isOverRecycler: nextIsOverRecycler,
            });
            dragSpringsApi.start({
                internalPosition: [
                    relative.x,
                    previewHoverHeight + 0.1,
                    relative.z,
                ],
            });
        }
    };

    const bindProps = useDrag(dragHandler, {
        filterTaps: true,
        enabled: !isDraggingWorld && !isPreviewAttached,
    })();

    const customBindProps = {
        ...bindProps,
        onPointerDown: (event: PointerEvent) => {
            event.stopPropagation();
            bindProps.onPointerDown?.(event);
        },
    };

    // Handle blocking drop when stack is not stackable
    const isGroupedPreviewBlocked =
        (isPreviewSource || isPreviewAttached) &&
        (activeDragPreview?.isBlocked ?? false);
    const showBlockedIndicator = isBlocked || isGroupedPreviewBlocked;
    const blockedScaleSprings = useSpring({
        scale: showBlockedIndicator ? 1 : 0,
        opacity: showBlockedIndicator ? 1 : 0,
        config: {
            tension: 350,
        },
    });
    const blockedPosition: [number, number, number] = [
        stack.position.x,
        currentStackHeight,
        stack.position.z,
    ];

    // Handle recycle indicator
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
            {...customBindProps}
        >
            <animated.group
                scale={blockedScaleSprings.scale}
                position={blockedPosition}
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
            {/* <group
                position={[
                    stack.position.x,
                    currentBlockData?.attributes.height ?? 0,
                    stack.position.z,
                ]}
            >
                <Html center>
                    <MoveIndicator />
                </Html>
            </group> */}
        </animated.group>
    );
}
