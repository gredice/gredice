import {
    canStackBlockOnBlock,
    getEffectiveGardenStackBlockHeight,
    getGardenBlockFootprintOffsets,
    getGardenStackHeightByBlockIds,
    isWaterOrSwampBlockName,
    requiresWaterOrSwampSupport,
    type GardenBlockDataLike as SharedGardenBlockDataLike,
} from '@gredice/js/gardenBlocks';

type StackPosition = {
    x: number;
    y: number;
    index?: number;
};

type GardenStack = {
    positionX: number;
    positionY: number;
    blocks: string[];
};

type BlockDataLike = SharedGardenBlockDataLike;

type OccupiedCell = {
    blockId: string;
    blockName: string;
    stackable: boolean;
    topHeight: number;
};

type ValidationResult =
    | { valid: true }
    | {
          valid: false;
          error: string;
      };

function findStackByPosition(stacks: GardenStack[], x: number, y: number) {
    return stacks.find(
        (candidate) => candidate.positionX === x && candidate.positionY === y,
    );
}

function cellKey(x: number, y: number) {
    return `${x}|${y}`;
}

function createOccupiedCells(params: {
    blockDataByName: Map<string, BlockDataLike>;
    blockNameById: Map<string, string>;
    blockRotationById?: Map<string, number | null | undefined>;
    movingBlockIds?: Set<string>;
    stacks: GardenStack[];
}) {
    const {
        blockDataByName,
        blockNameById,
        blockRotationById,
        movingBlockIds,
        stacks,
    } = params;
    const occupiedCells = new Map<string, OccupiedCell[]>();

    for (const stack of stacks) {
        let stackHeight = 0;
        let supportBlockName: string | undefined;
        for (const blockId of stack.blocks) {
            const blockName = blockNameById.get(blockId);
            if (!blockName) {
                continue;
            }

            const blockData = blockDataByName.get(blockName);
            const blockHeight = getEffectiveGardenStackBlockHeight({
                blockHeight: blockData?.attributes?.height ?? 0,
                blockName,
                supportBlockName,
            });
            if (!movingBlockIds?.has(blockId)) {
                for (const offset of getGardenBlockFootprintOffsets(
                    blockData,
                    blockRotationById?.get(blockId) ?? 0,
                )) {
                    const x = stack.positionX + offset.x;
                    const y = stack.positionY + offset.y;
                    const key = cellKey(x, y);
                    const existing = occupiedCells.get(key);
                    const cell = {
                        blockId,
                        blockName,
                        stackable: blockData?.attributes?.stackable ?? true,
                        topHeight: stackHeight + blockHeight,
                    };

                    if (existing) {
                        existing.push(cell);
                    } else {
                        occupiedCells.set(key, [cell]);
                    }
                }

                stackHeight += blockHeight;
                supportBlockName = blockName;
            }
        }
    }

    return occupiedCells;
}

function getTopOccupiedCell(
    occupiedCells: Map<string, OccupiedCell[]>,
    x: number,
    y: number,
) {
    const cells = occupiedCells.get(cellKey(x, y));
    if (!cells?.length) {
        return null;
    }

    // A collapsed water block is logically above its support at the same height.
    return cells.reduce((topCell, cell) =>
        cell.topHeight >= topCell.topHeight ? cell : topCell,
    );
}

export function validateStackPlacement(params: {
    blockIds: string[];
    blockNameById: Map<string, string>;
    blockDataByName: Map<string, BlockDataLike>;
}): ValidationResult {
    const { blockIds, blockNameById, blockDataByName } = params;
    const bottomBlockId = blockIds[0];
    const bottomBlockName = bottomBlockId
        ? blockNameById.get(bottomBlockId)
        : undefined;
    if (bottomBlockName && requiresWaterOrSwampSupport(bottomBlockName)) {
        return {
            valid: false,
            error: `Invalid stack placement: block ${bottomBlockId} requires water or swamp support`,
        };
    }

    for (let index = 1; index < blockIds.length; index++) {
        const belowBlockId = blockIds[index - 1];
        const aboveBlockId = blockIds[index];

        const belowBlockName = blockNameById.get(belowBlockId);
        if (!belowBlockName) {
            return {
                valid: false,
                error: `Invalid stack placement: unknown block ${belowBlockId} below ${aboveBlockId}`,
            };
        }

        const belowBlockData = blockDataByName.get(belowBlockName);
        const aboveBlockName = blockNameById.get(aboveBlockId);
        if (!aboveBlockName) {
            return {
                valid: false,
                error: `Invalid stack placement: unknown block ${aboveBlockId} above ${belowBlockId}`,
            };
        }

        const aboveBlockData = blockDataByName.get(aboveBlockName);
        if (
            !canStackBlockOnBlock({
                aboveBlockData,
                aboveBlockName,
                belowBlockData,
                belowBlockName,
            })
        ) {
            return {
                valid: false,
                error: `Invalid stack placement: block ${belowBlockId} cannot support block ${aboveBlockId}`,
            };
        }
    }

    return { valid: true };
}

export function validateSpanningBlockMove(params: {
    stacks: GardenStack[];
    fromPath: string;
    toPath: string;
    movedBlockId: string;
    blockNameById: Map<string, string>;
    blockDataByName: Map<string, BlockDataLike>;
    blockRotationById?: Map<string, number | null | undefined>;
    parsePath: (path: string) => StackPosition;
}): ValidationResult {
    const {
        stacks,
        fromPath,
        toPath,
        movedBlockId,
        blockNameById,
        blockDataByName,
        blockRotationById,
        parsePath,
    } = params;

    const movedBlockName = blockNameById.get(movedBlockId);
    if (!movedBlockName) {
        return { valid: true };
    }

    const movedBlockData = blockDataByName.get(movedBlockName);
    const footprintOffsets = getGardenBlockFootprintOffsets(
        movedBlockData,
        blockRotationById?.get(movedBlockId) ?? 0,
    );
    if (footprintOffsets.length <= 1) {
        return { valid: true };
    }

    const sourcePosition = parsePath(fromPath);
    if (sourcePosition.index === undefined) {
        return { valid: true };
    }

    const destinationPosition = parsePath(toPath);
    const movingBlockIds = new Set([movedBlockId]);
    const occupiedCells = createOccupiedCells({
        blockDataByName,
        blockNameById,
        blockRotationById,
        movingBlockIds,
        stacks,
    });

    let firstFootprintHeight: number | null = null;
    for (const offset of footprintOffsets) {
        const x = destinationPosition.x + offset.x;
        const y = destinationPosition.y + offset.y;
        const topOccupiedCell = getTopOccupiedCell(occupiedCells, x, y);
        if (
            requiresWaterOrSwampSupport(movedBlockName) &&
            (!topOccupiedCell ||
                !isWaterOrSwampBlockName(topOccupiedCell.blockName))
        ) {
            return {
                valid: false,
                error: `Invalid block placement: ${movedBlockName} requires water or swamp under every footprint cell`,
            };
        }
        if (
            topOccupiedCell &&
            !canStackBlockOnBlock({
                aboveBlockData: movedBlockData,
                aboveBlockName: movedBlockName,
                belowBlockData: blockDataByName.get(topOccupiedCell.blockName),
                belowBlockName: topOccupiedCell.blockName,
            })
        ) {
            return {
                valid: false,
                error: `Invalid block placement: block ${topOccupiedCell.blockId} cannot support ${movedBlockName}`,
            };
        }

        const destinationStack = findStackByPosition(stacks, x, y);
        const supportBlocks =
            destinationStack?.blocks.filter(
                (candidateId) => !movingBlockIds.has(candidateId),
            ) ?? [];
        const footprintHeight =
            topOccupiedCell?.topHeight ??
            getGardenStackHeightByBlockIds(
                supportBlocks,
                blockNameById,
                blockDataByName,
            );

        if (firstFootprintHeight === null) {
            firstFootprintHeight = footprintHeight;
        } else if (Math.abs(firstFootprintHeight - footprintHeight) > 0.0001) {
            return {
                valid: false,
                error: 'Invalid block placement: all spanned cells must be on the same level',
            };
        }
    }

    return { valid: true };
}
