export type GardenBlockStack = {
    positionX: number;
    positionY: number;
    blocks: string[];
};

export type GardenBlockDataLike = {
    attributes?: {
        stackable?: boolean | null;
        height?: number | null;
    } | null;
};

type Position = {
    x: number;
    y: number;
};

type Placement = Position & {
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
          placement: Placement;
      }
    | {
          valid: false;
          error: string;
      };

const CANDIDATE_BLOCK_ID = '__candidate_block__';
const MAX_SPIRAL_STEPS = 1000;
const WATER_BLOCK_NAME = 'Block_Water';

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

function findStackAtPosition(stacks: GardenBlockStack[], position: Position) {
    return stacks.find(
        (stack) =>
            stack.positionX === position.x && stack.positionY === position.y,
    );
}

function isGroundBlock(blockName: string) {
    return blockName.startsWith('Block');
}

function isWaterPlacement(
    placement: Placement,
    blockNameById: Map<string, string>,
) {
    return placement.existingBlocks.some(
        (blockId) => blockNameById.get(blockId) === WATER_BLOCK_NAME,
    );
}

export function validateStackPlacement(params: {
    blockIds: string[];
    blockNameById: Map<string, string>;
    blockDataByName: Map<string, GardenBlockDataLike>;
}): ValidationResult {
    const { blockIds, blockNameById, blockDataByName } = params;

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
    stacks: GardenBlockStack[];
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
        const stack = findStackAtPosition(stacks, position);
        if (!stack) {
            return false;
        }

        return stack.blocks.some(
            (blockId) => blockNameById.get(blockId) === 'Raised_Bed',
        );
    }).length;
}

export function validateRaisedBedPlacement(params: {
    stacks: GardenBlockStack[];
    x: number;
    y: number;
    index: number;
    blockNameById: Map<string, string>;
}): ValidationResult {
    const { stacks, x, y, blockNameById } = params;
    const targetStack = findStackAtPosition(stacks, { x, y });

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
        const stack = findStackAtPosition(stacks, position);
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
        const neighborPosition = neighborPositions[0];
        if (!neighborPosition) {
            return { valid: true };
        }

        const { x: neighborX, y: neighborY } = neighborPosition;
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

function validatePlacementAtPosition(params: {
    blockName: string;
    position: Position;
    stacks: GardenBlockStack[];
    blockNameById: Map<string, string>;
    blockDataByName: Map<string, GardenBlockDataLike>;
}): GardenBlockPlacementResult {
    const { blockName, position, stacks, blockNameById, blockDataByName } =
        params;
    const existingBlocks =
        findStackAtPosition(stacks, position)?.blocks.slice() ?? [];

    if (isGroundBlock(blockName) && existingBlocks.length > 0) {
        return {
            valid: false,
            error: 'Invalid block placement: ground blocks can only be placed on empty stacks',
        };
    }

    const blockNameByIdWithCandidate = new Map(blockNameById);
    blockNameByIdWithCandidate.set(CANDIDATE_BLOCK_ID, blockName);

    const nextBlocks = [...existingBlocks, CANDIDATE_BLOCK_ID];
    const stackValidation = validateStackPlacement({
        blockIds: nextBlocks,
        blockNameById: blockNameByIdWithCandidate,
        blockDataByName,
    });
    if (!stackValidation.valid) {
        return stackValidation;
    }

    if (blockName === 'Raised_Bed') {
        const placementValidation = validateRaisedBedPlacement({
            stacks,
            x: position.x,
            y: position.y,
            index: existingBlocks.length,
            blockNameById,
        });
        if (!placementValidation.valid) {
            return placementValidation;
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

export function resolveGardenBlockPlacement(params: {
    blockName: string;
    stacks: GardenBlockStack[];
    blockNameById: Map<string, string>;
    blockDataByName: Map<string, GardenBlockDataLike>;
    requestedPosition?: Position;
}): GardenBlockPlacementResult {
    const {
        blockName,
        stacks,
        blockNameById,
        blockDataByName,
        requestedPosition,
    } = params;

    if (requestedPosition) {
        return validatePlacementAtPosition({
            blockName,
            position: requestedPosition,
            stacks,
            blockNameById,
            blockDataByName,
        });
    }

    let waterPlacementFallback: GardenBlockPlacementResult | null = null;

    const originPlacement = validatePlacementAtPosition({
        blockName,
        position: { x: 0, y: 0 },
        stacks,
        blockNameById,
        blockDataByName,
    });
    if (originPlacement.valid) {
        if (isWaterPlacement(originPlacement.placement, blockNameById)) {
            waterPlacementFallback = originPlacement;
        } else {
            return originPlacement;
        }
    }

    for (let step = 0; step < MAX_SPIRAL_STEPS; step++) {
        const candidatePosition = spiral(step);
        const placement = validatePlacementAtPosition({
            blockName,
            position: candidatePosition,
            stacks,
            blockNameById,
            blockDataByName,
        });
        if (!placement.valid) {
            continue;
        }

        if (isWaterPlacement(placement.placement, blockNameById)) {
            waterPlacementFallback ??= placement;
            continue;
        }

        return placement;
    }

    if (waterPlacementFallback) {
        return waterPlacementFallback;
    }

    return {
        valid: false,
        error: 'No valid placement position found',
    };
}
