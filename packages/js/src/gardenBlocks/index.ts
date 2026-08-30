export type GardenBlockStack = {
    positionX: number;
    positionY: number;
    blocks: string[];
};

export type GardenBlockDataLike = {
    attributes?: {
        stackable?: boolean | null;
        height?: number | null;
        spanWidth?: number | null;
        spanDepth?: number | null;
        placeableOnWater?: boolean | null;
    } | null;
};

type Position = {
    x: number;
    y: number;
};

export type GardenBlockFootprint = {
    width: number;
    depth: number;
};

export type GardenBlockFootprintOffset = Position;

type OccupiedCell = {
    blockId: string;
    blockName: string;
    stackable: boolean;
    topHeight: number;
};

type GardenBlockPlacement = Position & {
    index: number;
    existingBlocks: string[];
};

type ValidationResult =
    | { valid: true }
    | {
          valid: false;
          error: string;
      };

export type GardenBlockPlacementResult =
    | {
          valid: true;
          placement: GardenBlockPlacement;
      }
    | {
          valid: false;
          error: string;
      };

const CANDIDATE_BLOCK_ID = '__candidate_block__';
const MAX_SPIRAL_STEPS = 1000;
export const WATER_BLOCK_NAME = 'Block_Water';
export const WATER_BLOCK_NAMES = [
    WATER_BLOCK_NAME,
    'Block_Swamp_Water',
] as const;
const GARDEN_SURFACE_COVER_BLOCK_NAMES = new Set([
    'MulchCoconut',
    'MulchHey',
    'MulchWood',
    'StoneWalkway',
    'WoodenWalkway',
]);
const TERRAIN_STAIR_BLOCK_NAMES = new Set([
    'Block_Stone_Stairs',
    'Block_Polished_Stone_Stairs',
    'Block_Stone_Stairs_Corner',
    'Block_Polished_Stone_Stairs_Corner',
    'Block_Stone_Stairs_Half',
]);
export const SWAMP_BLOCK_NAME = 'Block_Swamp';
export const FISHING_BOAT_BLOCK_NAME = 'FishingBoat';

export function isWaterBlockName(blockName: string) {
    return WATER_BLOCK_NAMES.some((name) => name === blockName);
}

export function isWaterOrSwampBlockName(blockName: string) {
    return (
        isWaterBlockName(blockName) ||
        blockName === SWAMP_BLOCK_NAME ||
        blockName.startsWith(`${SWAMP_BLOCK_NAME}_`)
    );
}

export function requiresWaterOrSwampSupport(blockName: string) {
    return blockName === FISHING_BOAT_BLOCK_NAME;
}

export function isEdgeOrCornerTerrainBlockName(blockName: string) {
    return (
        blockName.startsWith('Block_') &&
        !TERRAIN_STAIR_BLOCK_NAMES.has(blockName) &&
        (blockName.endsWith('_Angle') || blockName.endsWith('_Corner'))
    );
}

export function getEffectiveGardenStackBlockHeight({
    blockHeight,
    blockName,
    supportBlockName,
}: {
    blockHeight: number;
    blockName: string;
    supportBlockName: string | undefined;
}) {
    if (
        isWaterBlockName(blockName) &&
        supportBlockName &&
        isEdgeOrCornerTerrainBlockName(supportBlockName)
    ) {
        return 0;
    }

    return blockHeight;
}

function toPositiveGridSpan(value: number | null | undefined) {
    return typeof value === 'number' && Number.isFinite(value) && value > 0
        ? Math.max(1, Math.ceil(value))
        : 1;
}

export function getGardenBlockSpan(
    blockData: GardenBlockDataLike | null | undefined,
    rotation = 0,
): GardenBlockFootprint {
    const width = toPositiveGridSpan(blockData?.attributes?.spanWidth);
    const depth = toPositiveGridSpan(blockData?.attributes?.spanDepth);
    const normalizedRotation = ((Math.round(rotation) % 2) + 2) % 2;

    return normalizedRotation === 1
        ? { width: depth, depth: width }
        : { width, depth };
}

export function getGardenBlockFootprintOffsets(
    blockData: GardenBlockDataLike | null | undefined,
    rotation = 0,
): GardenBlockFootprintOffset[] {
    const span = getGardenBlockSpan(blockData, rotation);
    const offsets: GardenBlockFootprintOffset[] = [];

    for (let x = 0; x < span.width; x++) {
        for (let y = 0; y < span.depth; y++) {
            offsets.push({ x, y });
        }
    }

    return offsets;
}

function spiral(step: number): Position {
    const r = Math.floor((Math.sqrt(step + 1) - 1) / 2) + 1;
    const p = (8 * r * (r - 1)) / 2;
    const en = r * 2;
    const a = (1 + step - p) % (r * 8);

    switch (Math.floor(a / (r * 2))) {
        case 0:
            return { x: a - r, y: -r };
        case 1:
            return { x: r, y: (a % en) - r };
        case 2:
            return { x: r - (a % en), y: r };
        case 3:
            return { x: -r, y: r - (a % en) };
        default:
            return { x: 0, y: 0 };
    }
}

function addPositions(left: Position, right: Position): Position {
    return {
        x: left.x + right.x,
        y: left.y + right.y,
    };
}

function toGridPosition(position: Position): Position {
    return {
        x: Math.round(position.x),
        y: Math.round(position.y),
    };
}

function findStackAtPosition(stacks: GardenBlockStack[], position: Position) {
    return stacks.find(
        (stack) =>
            stack.positionX === position.x && stack.positionY === position.y,
    );
}

function cellKey(position: Position) {
    return `${position.x}|${position.y}`;
}

function getBlockHeight(
    blockName: string,
    blockDataByName: Map<string, GardenBlockDataLike>,
) {
    return blockDataByName.get(blockName)?.attributes?.height ?? 0;
}

export function getGardenStackHeightByBlockIds(
    blockIds: string[],
    blockNameById: Map<string, string>,
    blockDataByName: Map<string, GardenBlockDataLike>,
) {
    let height = 0;
    let supportBlockName: string | undefined;

    for (const blockId of blockIds) {
        const blockName = blockNameById.get(blockId);
        if (!blockName) {
            continue;
        }

        height += getEffectiveGardenStackBlockHeight({
            blockHeight: getBlockHeight(blockName, blockDataByName),
            blockName,
            supportBlockName,
        });
        supportBlockName = blockName;
    }

    return height;
}

function createOccupiedCells(params: {
    blockDataByName: Map<string, GardenBlockDataLike>;
    blockNameById: Map<string, string>;
    blockRotationById?: Map<string, number | null | undefined>;
    movingBlockIds?: Set<string>;
    stacks: GardenBlockStack[];
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
                blockHeight: getBlockHeight(blockName, blockDataByName),
                blockName,
                supportBlockName,
            });
            if (!movingBlockIds?.has(blockId)) {
                for (const offset of getGardenBlockFootprintOffsets(
                    blockData,
                    blockRotationById?.get(blockId) ?? 0,
                )) {
                    const position = {
                        x: stack.positionX + offset.x,
                        y: stack.positionY + offset.y,
                    };
                    const key = cellKey(position);
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
    position: Position,
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

function isGroundBlock(blockName: string) {
    return blockName.startsWith('Block') && !isWaterBlockName(blockName);
}

function isWaterPlacement(params: {
    blockName: string;
    placement: GardenBlockPlacement;
    stacks: GardenBlockStack[];
    blockNameById: Map<string, string>;
    blockDataByName: Map<string, GardenBlockDataLike>;
}) {
    const { blockName, placement, stacks, blockNameById, blockDataByName } =
        params;
    const blockData = blockDataByName.get(blockName);

    return getGardenBlockFootprintOffsets(blockData).some((offset) => {
        const stack = findStackAtPosition(stacks, {
            x: placement.x + offset.x,
            y: placement.y + offset.y,
        });

        return stack?.blocks.some((blockId) => {
            const candidateName = blockNameById.get(blockId);
            return candidateName ? isWaterBlockName(candidateName) : false;
        });
    });
}

export function isBlockPlaceableOnWater({
    blockData,
    blockName,
}: {
    blockData: GardenBlockDataLike | undefined;
    blockName: string;
}) {
    return (
        blockData?.attributes?.placeableOnWater ?? isWaterBlockName(blockName)
    );
}

export function canStackBlockOnBlock({
    aboveBlockData,
    aboveBlockName,
    belowBlockData,
    belowBlockName,
}: {
    aboveBlockData: GardenBlockDataLike | undefined;
    aboveBlockName: string;
    belowBlockData: GardenBlockDataLike | undefined;
    belowBlockName: string;
}) {
    if (
        !belowBlockData?.attributes?.stackable &&
        !GARDEN_SURFACE_COVER_BLOCK_NAMES.has(belowBlockName)
    ) {
        return false;
    }

    if (requiresWaterOrSwampSupport(aboveBlockName)) {
        return isWaterOrSwampBlockName(belowBlockName);
    }

    if (!isWaterBlockName(belowBlockName)) {
        return true;
    }

    return isBlockPlaceableOnWater({
        blockData: aboveBlockData,
        blockName: aboveBlockName,
    });
}

export function validateStackPlacement(params: {
    blockIds: string[];
    blockNameById: Map<string, string>;
    blockDataByName: Map<string, GardenBlockDataLike>;
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
        if (belowBlockId === undefined || aboveBlockId === undefined) {
            return {
                valid: false,
                error: 'Invalid stack placement: missing block id',
            };
        }

        const belowBlockName = blockNameById.get(belowBlockId);
        if (!belowBlockName) {
            return {
                valid: false,
                error: `Invalid stack placement: unknown block ${belowBlockId} below ${aboveBlockId}`,
            };
        }

        const aboveBlockName = blockNameById.get(aboveBlockId);
        if (!aboveBlockName) {
            return {
                valid: false,
                error: `Invalid stack placement: unknown block ${aboveBlockId} above ${belowBlockId}`,
            };
        }

        const belowBlockData = blockDataByName.get(belowBlockName);
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

function validatePlacementAtPosition(params: {
    blockName: string;
    blockedCells?: ReadonlySet<string>;
    position: Position;
    occupiedCells: Map<string, OccupiedCell[]>;
    stacks: GardenBlockStack[];
    blockNameById: Map<string, string>;
    blockDataByName: Map<string, GardenBlockDataLike>;
}): GardenBlockPlacementResult {
    const {
        blockName,
        blockedCells,
        position,
        occupiedCells,
        stacks,
        blockNameById,
        blockDataByName,
    } = params;
    const blockData = blockDataByName.get(blockName);
    const existingBlocks =
        findStackAtPosition(stacks, position)?.blocks.slice() ?? [];

    const blockNameByIdWithCandidate = new Map(blockNameById);
    blockNameByIdWithCandidate.set(CANDIDATE_BLOCK_ID, blockName);

    let firstFootprintHeight: number | null = null;
    for (const offset of getGardenBlockFootprintOffsets(blockData)) {
        const footprintPosition = {
            x: position.x + offset.x,
            y: position.y + offset.y,
        };
        if (blockedCells?.has(cellKey(footprintPosition))) {
            return {
                valid: false,
                error: `Invalid block placement: structure occupies ${cellKey(footprintPosition)}`,
            };
        }
        const footprintStack =
            findStackAtPosition(stacks, footprintPosition)?.blocks.slice() ??
            [];
        const topOccupiedCell = getTopOccupiedCell(
            occupiedCells,
            footprintPosition,
        );

        if (
            requiresWaterOrSwampSupport(blockName) &&
            (!topOccupiedCell ||
                !isWaterOrSwampBlockName(topOccupiedCell.blockName))
        ) {
            return {
                valid: false,
                error: `Invalid block placement: ${blockName} requires water or swamp under every footprint cell`,
            };
        }

        if (
            isGroundBlock(blockName) &&
            (footprintStack.length > 0 || topOccupiedCell)
        ) {
            return {
                valid: false,
                error: 'Invalid block placement: ground blocks can only be placed on empty stacks',
            };
        }

        if (
            topOccupiedCell &&
            !canStackBlockOnBlock({
                aboveBlockData: blockData,
                aboveBlockName: blockName,
                belowBlockData: blockDataByName.get(topOccupiedCell.blockName),
                belowBlockName: topOccupiedCell.blockName,
            })
        ) {
            return {
                valid: false,
                error: `Invalid block placement: block ${topOccupiedCell.blockId} cannot support ${blockName}`,
            };
        }

        const nextBlocks = [...footprintStack, CANDIDATE_BLOCK_ID];
        const stackValidation = validateStackPlacement({
            blockIds: nextBlocks,
            blockNameById: blockNameByIdWithCandidate,
            blockDataByName,
        });
        if (!stackValidation.valid) {
            return stackValidation;
        }

        const footprintHeight =
            topOccupiedCell?.topHeight ??
            getGardenStackHeightByBlockIds(
                footprintStack,
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

    return {
        valid: true,
        placement: {
            x: position.x,
            y: position.y,
            index: existingBlocks.length,
            existingBlocks,
        },
    };
}

function resolveAutomaticGardenBlockPlacement(params: {
    blockName: string;
    blockedCells?: ReadonlySet<string>;
    occupiedCells: Map<string, OccupiedCell[]>;
    searchOrigin: Position;
    stacks: GardenBlockStack[];
    blockNameById: Map<string, string>;
    blockDataByName: Map<string, GardenBlockDataLike>;
}): GardenBlockPlacementResult {
    const {
        blockName,
        blockedCells,
        occupiedCells,
        searchOrigin,
        stacks,
        blockNameById,
        blockDataByName,
    } = params;
    let waterPlacementFallback: GardenBlockPlacementResult | null = null;

    const validateCandidate = (
        candidatePosition: Position,
    ): GardenBlockPlacementResult | null => {
        const placement = validatePlacementAtPosition({
            blockName,
            blockedCells,
            occupiedCells,
            position: candidatePosition,
            stacks,
            blockNameById,
            blockDataByName,
        });
        if (!placement.valid) {
            return null;
        }

        if (
            isWaterPlacement({
                blockName,
                placement: placement.placement,
                stacks,
                blockNameById,
                blockDataByName,
            })
        ) {
            waterPlacementFallback ??= placement;
            return null;
        }

        return placement;
    };

    const searchOriginPlacement = validateCandidate(searchOrigin);
    if (searchOriginPlacement) {
        return searchOriginPlacement;
    }

    for (let step = 0; step < MAX_SPIRAL_STEPS; step++) {
        const placement = validateCandidate(
            addPositions(searchOrigin, spiral(step)),
        );
        if (placement) {
            return placement;
        }
    }

    if (waterPlacementFallback) {
        return waterPlacementFallback;
    }

    return {
        valid: false,
        error: 'No valid placement position found',
    };
}

export function resolveGardenBlockPlacement(params: {
    blockName: string;
    blockedCells?: ReadonlySet<string>;
    stacks: GardenBlockStack[];
    blockNameById: Map<string, string>;
    blockDataByName: Map<string, GardenBlockDataLike>;
    blockRotationById?: Map<string, number | null | undefined>;
    preferredPosition?: Position;
    requestedPosition?: Position;
}): GardenBlockPlacementResult {
    const {
        blockName,
        blockedCells,
        stacks,
        blockNameById,
        blockDataByName,
        blockRotationById,
        preferredPosition,
        requestedPosition,
    } = params;
    const occupiedCells = createOccupiedCells({
        blockDataByName,
        blockNameById,
        blockRotationById,
        stacks,
    });

    if (requestedPosition) {
        return validatePlacementAtPosition({
            blockName,
            blockedCells,
            occupiedCells,
            position: requestedPosition,
            stacks,
            blockNameById,
            blockDataByName,
        });
    }

    return resolveAutomaticGardenBlockPlacement({
        blockName,
        blockedCells,
        occupiedCells,
        stacks,
        blockNameById,
        blockDataByName,
        searchOrigin: preferredPosition
            ? toGridPosition(preferredPosition)
            : { x: 0, y: 0 },
    });
}
