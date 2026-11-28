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

/** A garden grid cell. `y` is the garden's depth axis (world z). */
export type GardenBlockGridPosition = {
    x: number;
    y: number;
};

type Position = GardenBlockGridPosition;

export type GardenBlockFootprint = {
    width: number;
    depth: number;
};

export type GardenBlockFootprintOffset = Position;

type OccupiedCell = {
    blockId: string;
    blockName: string;
    stackable: boolean;
    baseHeight: number;
    topHeight: number;
};

/** Where one placed block sits in the garden's height model. */
export type GardenBlockLevel = {
    blockId: string;
    blockName: string;
    /** The surface the block stands on. */
    baseHeight: number;
    /**
     * The block's top surface. Equal to `baseHeight` for blocks with no
     * height and for water collapsed on edge or corner terrain.
     */
    topHeight: number;
};

export type GardenBlockPlacement = Position & {
    index: number;
    existingBlocks: string[];
};

/** A valid placement plus the surface height its footprint rests on. */
export type GardenBlockValidatedPlacement = GardenBlockPlacement & {
    baseHeight: number;
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

export type GardenBlockPlacementValidationResult =
    | {
          valid: true;
          placement: GardenBlockValidatedPlacement;
      }
    | {
          valid: false;
          error: string;
      };

/**
 * Checks many candidate cells for one block type against one garden
 * snapshot. Occupancy and the stack index are built once, so each check is
 * O(footprint × stack height) instead of O(garden).
 */
export type GardenBlockPlacementValidator = {
    /** The block type every check is made for. */
    readonly blockName: string;
    /** Same rules as `resolveGardenBlockPlacement` with a requested position. */
    validate(
        position: GardenBlockGridPosition,
        rotation?: number | null,
    ): GardenBlockPlacementValidationResult;
    /** Highest surface over the cell, including blocks anchored on neighbours. */
    getCellTopHeight(position: GardenBlockGridPosition): number;
    /** True when the cell has no stacked block and no neighbour footprint. */
    isCellEmpty(position: GardenBlockGridPosition): boolean;
    /** A copy of the stack's block ids at the cell (empty when none). */
    getStackBlockIds(position: GardenBlockGridPosition): string[];
    /**
     * The cell's own stack, bottom first, with each block's base and top
     * surface. Blocks with an unknown name are left out, as they are when
     * heights are summed.
     */
    getStackBlockLevels(position: GardenBlockGridPosition): GardenBlockLevel[];
    /**
     * The block a new block at the cell would stand on: the highest block
     * over the cell, including blocks anchored on neighbouring cells. On a
     * tie the later block wins, so collapsed water wins over its support.
     * Null when no known block covers the cell.
     */
    getCellTopBlock(position: GardenBlockGridPosition): GardenBlockLevel | null;
    /**
     * Returns a new validator that also contains `blockId` (a block of
     * `blockName`) on top of the stack at `position`. This validator is not
     * changed.
     */
    withPlacedBlock(input: {
        position: GardenBlockGridPosition;
        blockId: string;
        rotation?: number | null;
    }): GardenBlockPlacementValidator;
};

const gardenBlockQuarterTurns = [0, 1, 2, 3] as const;
export type GardenBlockQuarterTurns = (typeof gardenBlockQuarterTurns)[number];

/**
 * Stored rotations are any int32 or null, and rotating sends `rotation + 1`
 * without wrapping. Copies and batch writes use quarter turns 0–3.
 */
export function normalizeGardenBlockRotation(
    rotation: number | null | undefined,
): GardenBlockQuarterTurns {
    if (typeof rotation !== 'number' || !Number.isFinite(rotation)) {
        return 0;
    }

    return gardenBlockQuarterTurns[((Math.round(rotation) % 4) + 4) % 4] ?? 0;
}

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

function cellKey(position: Position) {
    return `${position.x}|${position.y}`;
}

type BlockNameLookup = (blockId: string) => string | undefined;

type PlacementIndexLayer = {
    readonly stacks: ReadonlyMap<string, readonly string[]>;
    readonly occupiedCells: ReadonlyMap<string, readonly OccupiedCell[]>;
    readonly blockNameById: ReadonlyMap<string, string>;
};

/**
 * Garden snapshot indexed by cell. `overrides` holds blocks added with
 * `withPlacedBlock`; a key in an override replaces the base entry.
 */
type PlacementIndex = PlacementIndexLayer & {
    readonly overrides?: PlacementIndexLayer;
};

function getIndexedStack(index: PlacementIndex, position: Position) {
    const key = cellKey(position);
    return index.overrides?.stacks.get(key) ?? index.stacks.get(key);
}

function getIndexedOccupiedCells(index: PlacementIndex, position: Position) {
    const key = cellKey(position);
    return (
        index.overrides?.occupiedCells.get(key) ?? index.occupiedCells.get(key)
    );
}

function getIndexedBlockName(index: PlacementIndex, blockId: string) {
    return (
        index.overrides?.blockNameById.get(blockId) ??
        index.blockNameById.get(blockId)
    );
}

function createStackIndex(stacks: GardenBlockStack[]) {
    const stacksByCell = new Map<string, readonly string[]>();
    for (const stack of stacks) {
        // A NaN position never matched a stack lookup by `===`.
        if (Number.isNaN(stack.positionX) || Number.isNaN(stack.positionY)) {
            continue;
        }

        const key = cellKey({ x: stack.positionX, y: stack.positionY });
        // The first stack at a position wins, as a linear `find` did.
        if (!stacksByCell.has(key)) {
            stacksByCell.set(key, stack.blocks.slice());
        }
    }

    return stacksByCell;
}

function getBlockHeight(
    blockName: string,
    blockDataByName: Map<string, GardenBlockDataLike>,
) {
    return blockDataByName.get(blockName)?.attributes?.height ?? 0;
}

function getStackHeightAndSupport(
    blockIds: readonly string[],
    nameOf: BlockNameLookup,
    blockDataByName: Map<string, GardenBlockDataLike>,
) {
    let height = 0;
    let supportBlockName: string | undefined;

    for (const blockId of blockIds) {
        const blockName = nameOf(blockId);
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

    return { height, supportBlockName };
}

function getStackBlockLevels(
    blockIds: readonly string[],
    nameOf: BlockNameLookup,
    blockDataByName: Map<string, GardenBlockDataLike>,
) {
    const levels: GardenBlockLevel[] = [];
    let height = 0;
    let supportBlockName: string | undefined;

    for (const blockId of blockIds) {
        const blockName = nameOf(blockId);
        if (!blockName) {
            continue;
        }

        const topHeight =
            height +
            getEffectiveGardenStackBlockHeight({
                blockHeight: getBlockHeight(blockName, blockDataByName),
                blockName,
                supportBlockName,
            });
        levels.push({ blockId, blockName, baseHeight: height, topHeight });
        height = topHeight;
        supportBlockName = blockName;
    }

    return levels;
}

export function getGardenStackHeightByBlockIds(
    blockIds: string[],
    blockNameById: Map<string, string>,
    blockDataByName: Map<string, GardenBlockDataLike>,
) {
    return getStackHeightAndSupport(
        blockIds,
        (blockId) => blockNameById.get(blockId),
        blockDataByName,
    ).height;
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
                        baseHeight: stackHeight,
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

function createPlacementIndex(params: {
    blockDataByName: Map<string, GardenBlockDataLike>;
    blockNameById: Map<string, string>;
    blockRotationById?: Map<string, number | null | undefined>;
    stacks: GardenBlockStack[];
}): PlacementIndex {
    return {
        stacks: createStackIndex(params.stacks),
        occupiedCells: createOccupiedCells(params),
        blockNameById: params.blockNameById,
    };
}

function getTopOccupiedCell(index: PlacementIndex, position: Position) {
    const cells = getIndexedOccupiedCells(index, position);
    if (!cells?.length) {
        return null;
    }

    // A collapsed water block is logically above its support at the same height.
    return cells.reduce((topCell, cell) =>
        cell.topHeight >= topCell.topHeight ? cell : topCell,
    );
}

function getIndexedCellTopHeight(
    index: PlacementIndex,
    position: Position,
    blockDataByName: Map<string, GardenBlockDataLike>,
) {
    return (
        getTopOccupiedCell(index, position)?.topHeight ??
        getStackHeightAndSupport(
            getIndexedStack(index, position) ?? [],
            (blockId) => getIndexedBlockName(index, blockId),
            blockDataByName,
        ).height
    );
}

function addBlockToPlacementIndex(params: {
    index: PlacementIndex;
    blockDataByName: Map<string, GardenBlockDataLike>;
    blockId: string;
    blockName: string;
    position: Position;
    rotation: number;
}): PlacementIndex {
    const { index, blockDataByName, blockId, blockName, position, rotation } =
        params;
    const currentStack = getIndexedStack(index, position) ?? [];
    const { height: stackHeight, supportBlockName } = getStackHeightAndSupport(
        currentStack,
        (candidateId) => getIndexedBlockName(index, candidateId),
        blockDataByName,
    );
    const blockData = blockDataByName.get(blockName);
    const occupiedCell: OccupiedCell = {
        blockId,
        blockName,
        stackable: blockData?.attributes?.stackable ?? true,
        baseHeight: stackHeight,
        topHeight:
            stackHeight +
            getEffectiveGardenStackBlockHeight({
                blockHeight: getBlockHeight(blockName, blockDataByName),
                blockName,
                supportBlockName,
            }),
    };

    const stacks = new Map<string, readonly string[]>(index.overrides?.stacks);
    stacks.set(cellKey(position), [...currentStack, blockId]);

    const occupiedCells = new Map<string, readonly OccupiedCell[]>(
        index.overrides?.occupiedCells,
    );
    for (const offset of getGardenBlockFootprintOffsets(blockData, rotation)) {
        const footprintPosition = addPositions(position, offset);
        occupiedCells.set(cellKey(footprintPosition), [
            ...(getIndexedOccupiedCells(index, footprintPosition) ?? []),
            occupiedCell,
        ]);
    }

    const blockNameById = new Map<string, string>(
        index.overrides?.blockNameById,
    );
    blockNameById.set(blockId, blockName);

    return {
        stacks: index.stacks,
        occupiedCells: index.occupiedCells,
        blockNameById: index.blockNameById,
        overrides: { stacks, occupiedCells, blockNameById },
    };
}

function isGroundBlock(blockName: string) {
    return blockName.startsWith('Block') && !isWaterBlockName(blockName);
}

function isWaterPlacement(params: {
    blockName: string;
    placement: GardenBlockPlacement;
    index: PlacementIndex;
    blockDataByName: Map<string, GardenBlockDataLike>;
}) {
    const { blockName, placement, index, blockDataByName } = params;
    const blockData = blockDataByName.get(blockName);

    return getGardenBlockFootprintOffsets(blockData).some((offset) => {
        const stack = getIndexedStack(index, addPositions(placement, offset));

        return stack?.some((blockId) => {
            const candidateName = getIndexedBlockName(index, blockId);
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
    return validateStackBlockIds(
        blockIds,
        (blockId) => blockNameById.get(blockId),
        blockDataByName,
    );
}

function validateStackBlockIds(
    blockIds: readonly string[],
    nameOf: BlockNameLookup,
    blockDataByName: Map<string, GardenBlockDataLike>,
): ValidationResult {
    const bottomBlockId = blockIds[0];
    const bottomBlockName = bottomBlockId ? nameOf(bottomBlockId) : undefined;
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

        const belowBlockName = nameOf(belowBlockId);
        if (!belowBlockName) {
            return {
                valid: false,
                error: `Invalid stack placement: unknown block ${belowBlockId} below ${aboveBlockId}`,
            };
        }

        const aboveBlockName = nameOf(aboveBlockId);
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
    requestedRotation?: number;
    blockName: string;
    position: Position;
    index: PlacementIndex;
    blockDataByName: Map<string, GardenBlockDataLike>;
}): GardenBlockPlacementValidationResult {
    const { blockName, position, index, blockDataByName } = params;
    const blockData = blockDataByName.get(blockName);
    const existingBlocks = getIndexedStack(index, position)?.slice() ?? [];
    const blockNameOf: BlockNameLookup = (blockId) =>
        getIndexedBlockName(index, blockId);
    const blockNameWithCandidateOf: BlockNameLookup = (blockId) =>
        blockId === CANDIDATE_BLOCK_ID ? blockName : blockNameOf(blockId);

    let firstFootprintHeight: number | null = null;
    for (const offset of getGardenBlockFootprintOffsets(
        blockData,
        params.requestedRotation,
    )) {
        const footprintPosition = addPositions(position, offset);
        const footprintStack = getIndexedStack(index, footprintPosition) ?? [];
        const topOccupiedCell = getTopOccupiedCell(index, footprintPosition);

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

        const stackValidation = validateStackBlockIds(
            [...footprintStack, CANDIDATE_BLOCK_ID],
            blockNameWithCandidateOf,
            blockDataByName,
        );
        if (!stackValidation.valid) {
            return stackValidation;
        }

        const footprintHeight =
            topOccupiedCell?.topHeight ??
            getStackHeightAndSupport(
                footprintStack,
                blockNameOf,
                blockDataByName,
            ).height;
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
            baseHeight: firstFootprintHeight ?? 0,
        },
    };
}

function toGardenBlockPlacementResult(
    result: GardenBlockPlacementValidationResult,
): GardenBlockPlacementResult {
    if (!result.valid) {
        return result;
    }

    const { x, y, index, existingBlocks } = result.placement;
    return { valid: true, placement: { x, y, index, existingBlocks } };
}

function resolveAutomaticGardenBlockPlacement(params: {
    blockName: string;
    index: PlacementIndex;
    searchOrigin: Position;
    blockDataByName: Map<string, GardenBlockDataLike>;
}): GardenBlockPlacementResult {
    const { blockName, index, searchOrigin, blockDataByName } = params;
    let waterPlacementFallback: GardenBlockPlacementResult | null = null;

    const validateCandidate = (
        candidatePosition: Position,
    ): GardenBlockPlacementResult | null => {
        const placement = toGardenBlockPlacementResult(
            validatePlacementAtPosition({
                blockName,
                index,
                position: candidatePosition,
                blockDataByName,
            }),
        );
        if (!placement.valid) {
            return null;
        }

        if (
            isWaterPlacement({
                blockName,
                placement: placement.placement,
                index,
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

function createValidatorFromIndex(params: {
    blockName: string;
    blockDataByName: Map<string, GardenBlockDataLike>;
    index: PlacementIndex;
}): GardenBlockPlacementValidator {
    const { blockName, blockDataByName, index } = params;

    return {
        blockName,
        validate: (position, rotation) =>
            validatePlacementAtPosition({
                blockName,
                blockDataByName,
                index,
                position,
                requestedRotation: rotation ?? undefined,
            }),
        getCellTopHeight: (position) =>
            getIndexedCellTopHeight(index, position, blockDataByName),
        isCellEmpty: (position) =>
            !getIndexedStack(index, position)?.length &&
            !getIndexedOccupiedCells(index, position)?.length,
        getStackBlockIds: (position) =>
            getIndexedStack(index, position)?.slice() ?? [],
        getStackBlockLevels: (position) =>
            getStackBlockLevels(
                getIndexedStack(index, position) ?? [],
                (blockId) => getIndexedBlockName(index, blockId),
                blockDataByName,
            ),
        getCellTopBlock: (position) => {
            const topCell = getTopOccupiedCell(index, position);
            return topCell
                ? {
                      blockId: topCell.blockId,
                      blockName: topCell.blockName,
                      baseHeight: topCell.baseHeight,
                      topHeight: topCell.topHeight,
                  }
                : null;
        },
        withPlacedBlock: ({ position, blockId, rotation }) =>
            createValidatorFromIndex({
                blockName,
                blockDataByName,
                index: addBlockToPlacementIndex({
                    index,
                    blockDataByName,
                    blockId,
                    blockName,
                    position,
                    rotation: rotation ?? 0,
                }),
            }),
    };
}

/**
 * Builds occupancy and the stack index once for a garden snapshot. The
 * snapshot is copied, so later changes to `stacks` or `blockNameById` do not
 * leak into the validator.
 */
export function createGardenBlockPlacementValidator(params: {
    blockName: string;
    stacks: GardenBlockStack[];
    blockNameById: Map<string, string>;
    blockDataByName: Map<string, GardenBlockDataLike>;
    blockRotationById?: Map<string, number | null | undefined>;
}): GardenBlockPlacementValidator {
    const { blockName, blockDataByName } = params;

    return createValidatorFromIndex({
        blockName,
        blockDataByName,
        index: createPlacementIndex({
            blockDataByName,
            blockNameById: new Map(params.blockNameById),
            blockRotationById: params.blockRotationById,
            stacks: params.stacks,
        }),
    });
}

export function resolveGardenBlockPlacement(params: {
    blockName: string;
    stacks: GardenBlockStack[];
    blockNameById: Map<string, string>;
    blockDataByName: Map<string, GardenBlockDataLike>;
    blockRotationById?: Map<string, number | null | undefined>;
    preferredPosition?: Position;
    requestedPosition?: Position;
    requestedRotation?: number;
}): GardenBlockPlacementResult {
    const {
        blockName,
        stacks,
        blockNameById,
        blockDataByName,
        blockRotationById,
        preferredPosition,
        requestedPosition,
    } = params;
    const index = createPlacementIndex({
        blockDataByName,
        blockNameById,
        blockRotationById,
        stacks,
    });

    if (requestedPosition) {
        return toGardenBlockPlacementResult(
            validatePlacementAtPosition({
                blockName,
                index,
                position: requestedPosition,
                requestedRotation: params.requestedRotation,
                blockDataByName,
            }),
        );
    }

    return resolveAutomaticGardenBlockPlacement({
        blockName,
        index,
        blockDataByName,
        searchOrigin: preferredPosition
            ? toGridPosition(preferredPosition)
            : { x: 0, y: 0 },
    });
}
