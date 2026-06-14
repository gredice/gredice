import type { BlockData } from '@gredice/client';
import {
    canStackBlockOnBlock,
    getGardenBlockFootprintOffsets,
} from '@gredice/js/gardenBlocks';
import type { Vector3 } from 'three';
import {
    type ActiveDragPreviewTargetOffset,
    createActiveDragPreviewTarget,
} from '../dragPreviewIdentity';
import type { Block } from '../types/Block';
import type { Stack } from '../types/Stack';
import { getBlockDataByName, getStackHeight } from '../utils/stackHeightCore';
import { isRecyclerPlacementTarget } from './recyclerPlacement';

export type MovingSegment = {
    sourceStack: Stack;
    sourceStartIndex: number;
    blocks: Stack['blocks'];
    baseHeight: number;
    canRecycle: boolean;
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
    relative: Vector3;
    previewHoverHeight: number;
    hoveredGardenBoxBlockId: string | null;
    canStoreInGardenBox: boolean;
    nextIsOverRecycler: boolean;
    nextIsBlocked: boolean;
    targetOffsets: ActiveDragPreviewTargetOffset[];
};

function getStack(
    stacks: Stack[] | undefined,
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
    stack: Stack;
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
    stacks: Stack[] | undefined;
}) {
    const occupiedCells = new Map<string, OccupiedCell[]>();

    for (const stack of stacks ?? []) {
        let stackHeight = 0;
        stack.blocks.forEach((block, blockIndex) => {
            const blockEntity = getBlockDataByName(blockData, block.name);
            const blockHeight = blockEntity?.attributes?.height ?? 0;

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

    return cells.reduce((topCell, cell) =>
        cell.topHeight > topCell.topHeight ? cell : topCell,
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

function getExternalRaisedBedBlockAtPosition({
    movingBlockIds,
    stacks,
    x,
    z,
}: {
    movingBlockIds: Set<string>;
    stacks: Stack[] | undefined;
    x: number;
    z: number;
}): Block | null {
    const stackAtPosition = getStack(stacks, { x, z });
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

function hasExternalRaisedBedNeighbor({
    excludedPositions,
    movingBlockIds,
    stacks,
    x,
    z,
}: {
    excludedPositions: Set<string>;
    movingBlockIds: Set<string>;
    stacks: Stack[] | undefined;
    x: number;
    z: number;
}) {
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
            getExternalRaisedBedBlockAtPosition({
                movingBlockIds,
                stacks,
                x: neighbor.x,
                z: neighbor.z,
            }),
        );
    });
}

function isRaisedBedPlacementBlocked({
    movingBlockIds,
    movedRaisedBedPreviews,
    stacks,
}: {
    movingBlockIds: Set<string>;
    movedRaisedBedPreviews: PlacementPreview[];
    stacks: Stack[] | undefined;
}) {
    const movedRaisedBedPreviewByPosition = new Map(
        movedRaisedBedPreviews.map((preview) => [
            `${preview.destination.x}|${preview.destination.z}`,
            preview,
        ]),
    );

    return movedRaisedBedPreviews.some((preview) => {
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

            const externalNeighborBlock = getExternalRaisedBedBlockAtPosition({
                movingBlockIds,
                stacks,
                x: neighbor.x,
                z: neighbor.z,
            });
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

        return hasExternalRaisedBedNeighbor({
            excludedPositions,
            movingBlockIds,
            stacks,
            x: externalNeighbor.x,
            z: externalNeighbor.z,
        });
    });
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
    relative: Vector3;
    stacks: Stack[] | undefined;
}): ResolvedPlacementPreview | null {
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

    const placementPreviews: PlacementPreview[] = movingSegments.flatMap(
        (segment) => {
            if (!segment.blocks[0]) {
                return [];
            }

            const destination = {
                x: segment.sourceStack.position.x + relative.x,
                z: segment.sourceStack.position.z + relative.z,
            };
            const footprintOffsets = getSegmentFootprintOffsets(
                blockData,
                segment,
            );
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
                const isSupported =
                    !occupiedCell ||
                    (movingBaseBlock
                        ? canStackBlockOnBlock({
                              aboveBlockData: movingBaseBlockData ?? undefined,
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
        },
    );

    const movedRaisedBedPreviews = placementPreviews.filter((preview) =>
        preview.segment.blocks.some(
            (segmentBlock) => segmentBlock.name === 'Raised_Bed',
        ),
    );
    const raisedBedPlacementBlocked = isRaisedBedPlacementBlocked({
        movingBlockIds,
        movedRaisedBedPreviews,
        stacks,
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
