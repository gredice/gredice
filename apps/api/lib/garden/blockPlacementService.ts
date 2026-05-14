import type { SelectGardenStack } from '@gredice/storage';
import {
    validateRaisedBedPlacement,
    validateStackPlacement,
} from './stacksPatchValidation';

type BlockDataLike = {
    attributes?: {
        stackable?: boolean;
        height?: number;
    };
};

type Position = {
    x: number;
    y: number;
};

type Placement = Position & {
    index: number;
    existingBlocks: string[];
};

type PlacementResult =
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

function findStackAtPosition(
    stacks: Pick<SelectGardenStack, 'positionX' | 'positionY' | 'blocks'>[],
    position: Position,
) {
    return stacks.find(
        (stack) =>
            stack.positionX === position.x && stack.positionY === position.y,
    );
}

function isGroundBlock(blockName: string) {
    return blockName.startsWith('Block');
}

function validatePlacementAtPosition(params: {
    blockName: string;
    position: Position;
    stacks: Pick<SelectGardenStack, 'positionX' | 'positionY' | 'blocks'>[];
    blockNameById: Map<string, string>;
    blockDataByName: Map<string, BlockDataLike>;
}): PlacementResult {
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
    stacks: Pick<SelectGardenStack, 'positionX' | 'positionY' | 'blocks'>[];
    blockNameById: Map<string, string>;
    blockDataByName: Map<string, BlockDataLike>;
    requestedPosition?: Position;
}): PlacementResult {
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

    const originPlacement = validatePlacementAtPosition({
        blockName,
        position: { x: 0, y: 0 },
        stacks,
        blockNameById,
        blockDataByName,
    });
    if (originPlacement.valid) {
        return originPlacement;
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
        if (placement.valid) {
            return placement;
        }
    }

    return {
        valid: false,
        error: 'No valid placement position found',
    };
}
