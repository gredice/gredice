import {
    getGardenBlockFootprintOffsets,
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
    stackable: boolean;
    topHeight: number;
};

type ValidationResult =
    | { valid: true }
    | {
          valid: false;
          error: string;
      };

function getBlockHeight(
    blockId: string,
    blockNameById: Map<string, string>,
    blockDataByName: Map<string, BlockDataLike>,
) {
    const blockName = blockNameById.get(blockId);
    if (!blockName) {
        return 0;
    }

    return blockDataByName.get(blockName)?.attributes?.height ?? 0;
}

function getStackHeightByBlockIds(
    blockIds: string[],
    blockNameById: Map<string, string>,
    blockDataByName: Map<string, BlockDataLike>,
) {
    return blockIds.reduce(
        (height, blockId) =>
            height + getBlockHeight(blockId, blockNameById, blockDataByName),
        0,
    );
}

function getHeightBeforeIndex(
    blockIds: string[],
    index: number,
    blockNameById: Map<string, string>,
    blockDataByName: Map<string, BlockDataLike>,
) {
    return blockIds
        .slice(0, index)
        .reduce(
            (height, blockId) =>
                height +
                getBlockHeight(blockId, blockNameById, blockDataByName),
            0,
        );
}

function findStackByPosition(stacks: GardenStack[], x: number, y: number) {
    return stacks.find(
        (candidate) => candidate.positionX === x && candidate.positionY === y,
    );
}

function cellKey(x: number, y: number) {
    return `${x}|${y}`;
}

function findBlockPlacement(stacks: GardenStack[], blockId: string) {
    for (const stack of stacks) {
        const index = stack.blocks.indexOf(blockId);
        if (index >= 0) {
            return {
                x: stack.positionX,
                y: stack.positionY,
                index,
                stack,
            };
        }
    }

    return null;
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
        for (const blockId of stack.blocks) {
            const blockName = blockNameById.get(blockId);
            if (!blockName) {
                continue;
            }

            const blockData = blockDataByName.get(blockName);
            const blockHeight = getBlockHeight(
                blockId,
                blockNameById,
                blockDataByName,
            );
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
                        stackable: blockData?.attributes?.stackable ?? true,
                        topHeight: stackHeight + blockHeight,
                    };

                    if (existing) {
                        existing.push(cell);
                    } else {
                        occupiedCells.set(key, [cell]);
                    }
                }
            }

            stackHeight += blockHeight;
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

    return cells.reduce((topCell, cell) =>
        cell.topHeight > topCell.topHeight ? cell : topCell,
    );
}

function findAttachedRaisedBedPlacement(
    stacks: GardenStack[],
    sourceBlockId: string,
    blockNameById: Map<string, string>,
) {
    const sourcePlacement = findBlockPlacement(stacks, sourceBlockId);
    if (!sourcePlacement) {
        return null;
    }

    return (
        stacks
            .map((candidateStack) => ({
                candidateStack,
                candidateBlockId: candidateStack.blocks[sourcePlacement.index],
            }))
            .find(({ candidateStack, candidateBlockId }) => {
                if (!candidateBlockId || candidateBlockId === sourceBlockId) {
                    return false;
                }

                const candidateBlockName = blockNameById.get(candidateBlockId);
                if (candidateBlockName !== 'Raised_Bed') {
                    return false;
                }

                const sameX = candidateStack.positionX === sourcePlacement.x;
                const sameY = candidateStack.positionY === sourcePlacement.y;

                return (
                    (sameX &&
                        Math.abs(
                            candidateStack.positionY - sourcePlacement.y,
                        ) === 1) ||
                    (sameY &&
                        Math.abs(
                            candidateStack.positionX - sourcePlacement.x,
                        ) === 1)
                );
            })?.candidateBlockId ?? null
    );
}

export function validateStackPlacement(params: {
    blockIds: string[];
    blockNameById: Map<string, string>;
    blockDataByName: Map<string, BlockDataLike>;
}): ValidationResult {
    const { blockIds, blockNameById, blockDataByName } = params;

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
        if (!belowBlockData?.attributes?.stackable) {
            return {
                valid: false,
                error: `Invalid stack placement: block ${belowBlockId} cannot support block ${aboveBlockId}`,
            };
        }
    }

    return { valid: true };
}

function getRaisedBedAdjacentCount(params: {
    stacks: GardenStack[];
    x: number;
    y: number;
    blockNameById: Map<string, string>;
}) {
    const { stacks, x, y, blockNameById } = params;
    const neighborPositions = [
        { x: x - 1, y },
        { x: x + 1, y },
        { x, y: y - 1 },
        { x, y: y + 1 },
    ];

    return neighborPositions.filter((position) => {
        const stack = findStackByPosition(stacks, position.x, position.y);
        if (!stack) {
            return false;
        }

        return stack.blocks.some(
            (blockId) => blockNameById.get(blockId) === 'Raised_Bed',
        );
    }).length;
}

export function validateRaisedBedPlacement(params: {
    stacks: GardenStack[];
    x: number;
    y: number;
    index: number;
    blockNameById: Map<string, string>;
}): ValidationResult {
    const { stacks, x, y, blockNameById } = params;
    const targetStack = findStackByPosition(stacks, x, y);

    if (
        targetStack?.blocks.some(
            (blockId) => blockNameById.get(blockId) === 'Raised_Bed',
        )
    ) {
        return {
            valid: false,
            error: 'Invalid raised bed placement: cannot stack on another raised bed',
        };
    }

    const neighborPositions = [
        { x: x - 1, y },
        { x: x + 1, y },
        { x, y: y - 1 },
        { x, y: y + 1 },
    ].filter((position) => {
        const stack = findStackByPosition(stacks, position.x, position.y);
        if (!stack) {
            return false;
        }

        return stack.blocks.some(
            (blockId) => blockNameById.get(blockId) === 'Raised_Bed',
        );
    });

    if (neighborPositions.length > 1) {
        return {
            valid: false,
            error: 'Invalid raised bed placement: cannot place next to multiple raised bed neighbors',
        };
    }

    if (neighborPositions.length === 1) {
        const [{ x: neighborX, y: neighborY }] = neighborPositions;
        const neighborAdjacentCount = getRaisedBedAdjacentCount({
            stacks,
            x: neighborX,
            y: neighborY,
            blockNameById,
        });
        if (neighborAdjacentCount > 0) {
            return {
                valid: false,
                error: 'Invalid raised bed placement: cannot place next to an already attached raised bed',
            };
        }
    }

    return { valid: true };
}

export function validateConnectedRaisedBedMove(params: {
    stacks: GardenStack[];
    fromPath: string;
    toPath: string;
    movedBlockId: string;
    blockNameById: Map<string, string>;
    blockDataByName: Map<string, BlockDataLike>;
    parsePath: (path: string) => StackPosition;
}): ValidationResult {
    const {
        stacks,
        fromPath,
        toPath,
        movedBlockId,
        blockNameById,
        blockDataByName,
        parsePath,
    } = params;

    const movedBlockName = blockNameById.get(movedBlockId);
    if (movedBlockName !== 'Raised_Bed') {
        return { valid: true };
    }

    const sourcePosition = parsePath(fromPath);
    const destinationPosition = parsePath(toPath);
    if (sourcePosition.index === undefined) {
        return { valid: true };
    }

    const sourcePlacement = findBlockPlacement(stacks, movedBlockId);
    if (!sourcePlacement) {
        return {
            valid: false,
            error: `Raised bed block ${movedBlockId} not found in stacks`,
        };
    }

    const attachedBlockId = findAttachedRaisedBedPlacement(
        stacks,
        movedBlockId,
        blockNameById,
    );
    if (!attachedBlockId) {
        return { valid: true };
    }

    const attachedPlacement = findBlockPlacement(stacks, attachedBlockId);
    if (!attachedPlacement) {
        return {
            valid: false,
            error: `Attached raised bed block ${attachedBlockId} not found in stacks`,
        };
    }

    const relativeX = destinationPosition.x - sourcePosition.x;
    const relativeY = destinationPosition.y - sourcePosition.y;

    const primaryDestination = {
        x: sourcePlacement.x + relativeX,
        y: sourcePlacement.y + relativeY,
    };
    const attachedDestination = {
        x: attachedPlacement.x + relativeX,
        y: attachedPlacement.y + relativeY,
    };

    const movingIds = new Set([movedBlockId, attachedBlockId]);
    const destinationSupportBlocks = [
        { blockId: movedBlockId, destination: primaryDestination },
        {
            blockId: attachedBlockId,
            destination: attachedDestination,
        },
    ].map(({ blockId, destination }) => {
        const destinationStack = findStackByPosition(
            stacks,
            destination.x,
            destination.y,
        );
        const supportBlocks =
            destinationStack?.blocks.filter(
                (candidateId) => !movingIds.has(candidateId),
            ) ?? [];

        return { blockId, supportBlocks };
    });

    for (const { blockId, supportBlocks } of destinationSupportBlocks) {
        const blockUnderId = supportBlocks[supportBlocks.length - 1];
        if (!blockUnderId) {
            continue;
        }

        const blockUnderName = blockNameById.get(blockUnderId);
        if (!blockUnderName) {
            return {
                valid: false,
                error: `Invalid stack placement: unknown block ${blockUnderId} below ${blockId}`,
            };
        }

        const blockUnderData = blockDataByName.get(blockUnderName);
        const isStackable = blockUnderData?.attributes?.stackable ?? true;
        if (!isStackable) {
            return {
                valid: false,
                error: `Invalid connected raised bed move: block ${blockUnderId} cannot support block ${blockId}`,
            };
        }
    }

    const primaryCurrentHeight = getHeightBeforeIndex(
        sourcePlacement.stack.blocks,
        sourcePlacement.index,
        blockNameById,
        blockDataByName,
    );
    const attachedCurrentHeight = getHeightBeforeIndex(
        attachedPlacement.stack.blocks,
        attachedPlacement.index,
        blockNameById,
        blockDataByName,
    );

    const primaryHoverHeight =
        getStackHeightByBlockIds(
            destinationSupportBlocks[0]?.supportBlocks ?? [],
            blockNameById,
            blockDataByName,
        ) - primaryCurrentHeight;
    const attachedHoverHeight =
        getStackHeightByBlockIds(
            destinationSupportBlocks[1]?.supportBlocks ?? [],
            blockNameById,
            blockDataByName,
        ) - attachedCurrentHeight;

    if (Math.abs(primaryHoverHeight - attachedHoverHeight) > 0.0001) {
        return {
            valid: false,
            error: 'Invalid connected raised bed move: both connected blocks must be placed on the same level',
        };
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
        if (topOccupiedCell && !topOccupiedCell.stackable) {
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
            getStackHeightByBlockIds(
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
