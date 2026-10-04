import type { Block } from '../types/Block';
import type { Stack } from '../types/Stack';
import { waterBlockBottomOverlap } from './waterBlockGeometry';
import { isWaterBlockName } from './waterBlockNames';

const terrainBlockPrefix = 'Block_';
const walkwayMetadataHeight = 0.1;
const walkwayVisualHeights: Partial<Record<string, number>> = {
    StoneWalkway: 0.064,
    WoodenWalkway: 0.096,
};

export function isWalkwayBlockName(name: string) {
    return walkwayVisualHeights[name] !== undefined;
}

export function isWaterCoveredByWalkway(stack: Stack, blockIndex: number) {
    const waterBlock = stack.blocks[blockIndex];
    if (!waterBlock || !isWaterBlockName(waterBlock.name)) {
        return false;
    }

    const nextNonWaterBlock = stack.blocks
        .slice(blockIndex + 1)
        .find((block) => !isWaterBlockName(block.name));

    return nextNonWaterBlock
        ? isWalkwayBlockName(nextNonWaterBlock.name)
        : false;
}

export function getWalkwayPlacementYOffset(
    stack: Stack | undefined,
    block: Block,
) {
    if (!stack) {
        return 0;
    }

    const walkwayIndex = stack.blocks.indexOf(block);
    const supportBlock = stack.blocks[walkwayIndex - 1];

    if (!supportBlock?.name.startsWith(terrainBlockPrefix)) {
        return 0;
    }

    return block.name === 'WoodenWalkway' ? -waterBlockBottomOverlap : 0;
}

export function getStackedOnWalkwayPlacementYOffset(
    stack: Stack | undefined,
    block: Block,
) {
    if (!stack) {
        return 0;
    }

    const blockIndex = stack.blocks.indexOf(block);
    const walkway = stack.blocks[blockIndex - 1];
    if (!walkway) {
        return 0;
    }

    const visualHeight = walkwayVisualHeights[walkway.name];
    if (visualHeight === undefined) {
        return 0;
    }

    return getWalkwayVisualTopOffset(stack, walkway) - walkwayMetadataHeight;
}

export function getWalkwayVisualTopOffset(
    stack: Stack | undefined,
    walkway: Block,
) {
    const visualHeight = walkwayVisualHeights[walkway.name];
    if (visualHeight === undefined) {
        return 0;
    }

    return getWalkwayPlacementYOffset(stack, walkway) + visualHeight;
}
