import type { BlockData } from '@gredice/client';
import {
    canStackBlockOnBlock,
    getGardenBlockFootprintOffsets,
    isWaterOrSwampBlockName,
    requiresWaterOrSwampSupport,
} from '@gredice/js/gardenBlocks';
import {
    type ActiveDragPreviewTargetOffset,
    createActiveDragPreviewTarget,
} from '../dragPreviewIdentity';
import type { Block } from '../types/Block';
import type { GardenStack } from '../types/Stack';
import {
    getBlockDataByName,
    getStackBlockHeight,
    getStackHeight,
} from '../utils/stackHeightCore';
import { isRecyclerPlacementTarget } from './recyclerPlacement';

export type MovingSegment = {
    sourceStack: GardenStack;
    sourceStartIndex: number;
    blocks: GardenStack['blocks'];
    baseHeight: number;
    canRecycle: boolean;
};

export type PickupPlacementRelative = {
    x: number;
    y: number;
    z: number;
};

type PlacementPreview = {
    blockUnderId: string | null;
    blockUnderName: string | null;
    destination: {
        x: number;
        z: number;
    };
    footprintCellCount: number;
    hoverHeight: number;
    isRecycler: boolean;
    isBlocked: boolean;
    segment: MovingSegment;
};

export type ResolvedPlacementPreview = {
    relative: PickupPlacementRelative;
    previewHoverHeight: number;
    hoveredGardenBoxBlockId: string | null;
    canStoreInGardenBox: boolean;
    nextIsOverRecycler: boolean;
    nextIsBlocked: boolean;
    targetOffsets: ActiveDragPreviewTargetOffset[];
};

export type PickupPlacementPreviewResolver = {
    resolveForRelative: (
        relative: PickupPlacementRelative,
    ) => ResolvedPlacementPreview | null;
};

function getStack(
    stacks: GardenStack[] | undefined,
    destination: { x: number; z: number },
) {
    return stacks?.find(
        (candidate) =>
            candidate.position.x === destination.x &&
            candidate.position.z === destination.z,
    );
}

type OccupiedCell = {
    block: Block;
    blockIndex: number;
    stack: GardenStack;
    stackable: boolean;
    topHeight: number;
};

function cellKey(position: { x: number; z: number }) {
    return `${position.x}|${position.z}`;
}

function createOccupiedCells({
    blockData,
    movingBlockIds,
    stacks,
}: {
    blockData: BlockData[] | null | undefined;
    movingBlockIds: Set<string>;
    stacks: GardenStack[] | undefined;
}) {
    const occupiedCells = new Map<string, OccupiedCell[]>();

    for (const stack of stacks ?? []) {
        let stackHeight = 0;
        stack.blocks.forEach((block, blockIndex) => {
            const blockEntity = getBlockDataByName(blockData, block.name);
            const blockHeight = getStackBlockHeight(
                blockData,
                stack,
                block,
                blockIndex,
            );

            if (!movingBlockIds.has(block.id)) {
                for (const offset of getGardenBlockFootprintOffsets(
                    blockEntity,
                    block.rotation,
                )) {
                    const position = {
                        x: stack.position.x + offset.x,
                        z: stack.position.z + offset.y,
                    };
                    const key = cellKey(position);
                    const existing = occupiedCells.get(key);
                    const cell = {
                        block,
                        blockIndex,
                        stack,
                        stackable: blockEntity?.attributes?.stackable ?? true,
                        topHeight: stackHeight + blockHeight,
                    };

                    if (existing) {
                        existing.push(cell);
                    } else {
                        occupiedCells.set(key, [cell]);
                    }
                }

                stackHeight += blockHeight;
            }
        });
    }

    return occupiedCells;
}

function getTopOccupiedCell(
    occupiedCells: Map<string, OccupiedCell[]>,
    position: { x: number; z: number },
) {
    const cells = occupiedCells.get(cellKey(position));
    if (!cells?.length) {
        return null;
    }

    // A collapsed water block is logically above its support at the same height.
    return cells.reduce((topCell, cell) =>
        cell.topHeight >= topCell.topHeight ? cell : topCell,
    );
}

function getSegmentFootprintOffsets(
    blockData: BlockData[] | null | undefined,
    segment: MovingSegment,
) {
    const offsetsByKey = new Map<string, { x: number; y: number }>();
    for (const block of segment.blocks) {
        const blockEntity = getBlockDataByName(blockData, block.name);
        for (const offset of getGardenBlockFootprintOffsets(
            blockEntity,
            block.rotation,
        )) {
            offsetsByKey.set(`${offset.x}|${offset.y}`, offset);
        }
    }

    return Array.from(offsetsByKey.values());
}

type PreparedMovingSegment = {
    footprintOffsets: { x: number; y: number }[];
    segment: MovingSegment;
};

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

export function resolvePickupPlacementPreviewForRelative({
    blockData,
    gardenIsSandbox,
    localSandboxStorageKey,
    movingSegments,
    relative,
    stacks,
}: {
    blockData: BlockData[] | null | undefined;
    gardenIsSandbox: boolean;
    localSandboxStorageKey: string | null;
    movingSegments: MovingSegment[];
    relative: PickupPlacementRelative;
    stacks: GardenStack[] | undefined;
}): ResolvedPlacementPreview | null {
    return (
        createPickupPlacementPreviewResolver({
            blockData,
            gardenIsSandbox,
            localSandboxStorageKey,
            movingSegments,
            stacks,
        })?.resolveForRelative(relative) ?? null
    );
}

export function createPickupPlacementPreviewResolver({
    blockData,
    gardenIsSandbox,
    localSandboxStorageKey,
    movingSegments,
    stacks,
}: {
    blockData: BlockData[] | null | undefined;
    gardenIsSandbox: boolean;
    localSandboxStorageKey: string | null;
    movingSegments: MovingSegment[];
    stacks: GardenStack[] | undefined;
}): PickupPlacementPreviewResolver | null {
    if (!blockData || movingSegments.length === 0) {
        return null;
    }

    const movingBlockIds = new Set(
        movingSegments.flatMap((segment) =>
            segment.blocks.map((segmentBlock) => segmentBlock.id),
        ),
    );
    const occupiedCells = createOccupiedCells({
        blockData,
        movingBlockIds,
        stacks,
    });
    const preparedMovingSegments: PreparedMovingSegment[] = movingSegments.map(
        (segment) => ({
            footprintOffsets: getSegmentFootprintOffsets(blockData, segment),
            segment,
        }),
    );

    return {
        resolveForRelative: (relative) =>
            resolvePickupPlacementPreviewFromPreparedState({
                blockData,
                gardenIsSandbox,
                localSandboxStorageKey,
                movingBlockIds,
                occupiedCells,
                preparedMovingSegments,
                relative,
                stacks,
            }),
    };
}

function resolvePickupPlacementPreviewFromPreparedState({
    blockData,
    gardenIsSandbox,
    localSandboxStorageKey,
    movingBlockIds,
    occupiedCells,
    preparedMovingSegments,
    relative,
    stacks,
}: {
    blockData: BlockData[];
    gardenIsSandbox: boolean;
    localSandboxStorageKey: string | null;
    movingBlockIds: Set<string>;
    occupiedCells: Map<string, OccupiedCell[]>;
    preparedMovingSegments: PreparedMovingSegment[];
    relative: PickupPlacementRelative;
    stacks: GardenStack[] | undefined;
}): ResolvedPlacementPreview | null {
    const placementPreviews: PlacementPreview[] =
        preparedMovingSegments.flatMap(({ footprintOffsets, segment }) => {
            if (!segment.blocks[0]) {
                return [];
            }

            const destination = {
                x: segment.sourceStack.position.x + relative.x,
                z: segment.sourceStack.position.z + relative.z,
            };
            const anchorOccupiedCell = getTopOccupiedCell(
                occupiedCells,
                destination,
            );
            const blockUnder = anchorOccupiedCell?.block;
            const blockUnderData = blockUnder
                ? getBlockDataByName(blockData, blockUnder.name)
                : null;
            const movingBaseBlock = segment.blocks[0];
            const movingBaseBlockData = movingBaseBlock
                ? getBlockDataByName(blockData, movingBaseBlock.name)
                : null;
            const isRecycler = isRecyclerPlacementTarget({
                canRecycle: segment.canRecycle,
                sourcePosition: segment.sourceStack.position,
                destination,
                blockUnderData,
            });
            const footprintHeights = footprintOffsets.map((offset) => {
                const footprintDestination = {
                    x: destination.x + offset.x,
                    z: destination.z + offset.y,
                };
                const occupiedCell = getTopOccupiedCell(
                    occupiedCells,
                    footprintDestination,
                );
                const supportStack = getStack(stacks, footprintDestination);
                const supportStackWithoutMoving = supportStack
                    ? {
                          ...supportStack,
                          blocks: supportStack.blocks.filter(
                              (candidate) => !movingBlockIds.has(candidate.id),
                          ),
                      }
                    : undefined;
                const occupiedBlockData = occupiedCell
                    ? getBlockDataByName(blockData, occupiedCell.block.name)
                    : null;
                const requiresWaterSupport = movingBaseBlock
                    ? requiresWaterOrSwampSupport(movingBaseBlock.name)
                    : false;
                const isSupported = requiresWaterSupport
                    ? Boolean(
                          occupiedCell &&
                              isWaterOrSwampBlockName(
                                  occupiedCell.block.name,
                              ) &&
                              movingBaseBlock &&
                              canStackBlockOnBlock({
                                  aboveBlockData:
                                      movingBaseBlockData ?? undefined,
                                  aboveBlockName: movingBaseBlock.name,
                                  belowBlockData:
                                      occupiedBlockData ?? undefined,
                                  belowBlockName: occupiedCell.block.name,
                              }),
                      )
                    : !occupiedCell ||
                      (movingBaseBlock
                          ? canStackBlockOnBlock({
                                aboveBlockData:
                                    movingBaseBlockData ?? undefined,
                                aboveBlockName: movingBaseBlock.name,
                                belowBlockData: occupiedBlockData ?? undefined,
                                belowBlockName: occupiedCell.block.name,
                            })
                          : true);

                return {
                    isBlocked: !isSupported,
                    hoverHeight:
                        (occupiedCell?.topHeight ??
                            getStackHeight(
                                blockData,
                                supportStackWithoutMoving,
                            )) - segment.baseHeight,
                };
            });
            const hoverHeight = Math.max(
                ...footprintHeights.map(
                    (footprintHeight) => footprintHeight.hoverHeight,
                ),
            );
            const cellsMismatch = footprintHeights.some(
                (footprintHeight) =>
                    Math.abs(hoverHeight - footprintHeight.hoverHeight) >
                    0.0001,
            );

            return [
                {
                    blockUnderId: blockUnder?.id ?? null,
                    blockUnderName: blockUnder?.name ?? null,
                    destination,
                    footprintCellCount: footprintOffsets.length,
                    hoverHeight,
                    isRecycler,
                    isBlocked:
                        (!isRecycler &&
                            footprintHeights.some(
                                (footprintHeight) => footprintHeight.isBlocked,
                            )) ||
                        cellsMismatch,
                    segment,
                },
            ];
        });

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
        !gardenIsSandbox &&
        hoveredGardenBoxBlockId !== null &&
        sourcePreview.segment.blocks.length === 1 &&
        sourcePreview.segment.blocks[0]?.name !== 'GardenBox' &&
        sourcePreview.segment.blocks[0]?.name !== 'Raised_Bed' &&
        sourcePreview.footprintCellCount === 1 &&
        placementPreviews.length === 1;
    const heightsMismatch = placementPreviews.some(
        (preview) => Math.abs(sourceHoverHeight - preview.hoverHeight) > 0.0001,
    );
    const nextIsOverRecycler = sourcePreview.isRecycler;
    const nextIsBlocked = nextIsOverRecycler
        ? false
        : canStoreInGardenBox
          ? false
          : placementPreviews.some((preview) => preview.isBlocked) ||
            heightsMismatch;

    return {
        relative: {
            x: relative.x,
            y: relative.y,
            z: relative.z,
        },
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
