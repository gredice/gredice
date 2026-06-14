import type { BlockData } from '@gredice/client';
import type { Block } from '../types/Block';
import type { Stack } from '../types/Stack';
import { getBlockDataByName, getStackHeight } from '../utils/stackHeightCore';
import {
    defaultWaterBlockVisualHeight,
    waterBlockBottomOverlap,
} from './waterBlockGeometry';

export const shapedTerrainWaterTopInset = waterBlockBottomOverlap;

export type WaterBlockVerticalRange = {
    max: number;
    min: number;
};

function isEdgeOrCornerTerrainBlock(blockName: string) {
    return (
        blockName.startsWith('Block_') &&
        (blockName.endsWith('_Angle') || blockName.endsWith('_Corner'))
    );
}

function getWaterBlockIndex(stack: Stack, block: Block) {
    return stack.blocks.indexOf(block);
}

function getWaterSupportBlock(stack: Stack, block: Block) {
    const waterBlockIndex = getWaterBlockIndex(stack, block);
    return waterBlockIndex > 0 ? stack.blocks[waterBlockIndex - 1] : null;
}

function isWaterFillSupportBlock(stack: Stack, block: Block) {
    const supportBlock = getWaterSupportBlock(stack, block);
    return supportBlock ? isEdgeOrCornerTerrainBlock(supportBlock.name) : false;
}

export function getWaterBlockVisualHeight({
    block,
    blockData,
    stack,
}: {
    block: Block;
    blockData: BlockData[] | null | undefined;
    stack: Stack;
}) {
    const supportBlock = getWaterSupportBlock(stack, block);

    if (!supportBlock || !isEdgeOrCornerTerrainBlock(supportBlock.name)) {
        return defaultWaterBlockVisualHeight;
    }

    const supportHeight =
        getBlockDataByName(blockData, supportBlock.name)?.attributes.height ??
        defaultWaterBlockVisualHeight;

    return Math.max(supportHeight - shapedTerrainWaterTopInset, 0);
}

export function getWaterBlockVerticalRange({
    block,
    blockData,
    stack,
}: {
    block: Block;
    blockData: BlockData[] | null | undefined;
    stack: Stack;
}) {
    const waterBlockIndex = getWaterBlockIndex(stack, block);
    if (waterBlockIndex < 0) {
        return null;
    }

    if (!blockData) {
        return {
            min: waterBlockIndex,
            max: waterBlockIndex + 1,
        } satisfies WaterBlockVerticalRange;
    }

    const stackHeight = getStackHeight(blockData, stack, block);
    const waterHeight = getWaterBlockVisualHeight({
        block,
        blockData,
        stack,
    });

    if (isWaterFillSupportBlock(stack, block)) {
        const waterTop = stackHeight - shapedTerrainWaterTopInset;
        return {
            min: waterTop - waterHeight,
            max: waterTop,
        } satisfies WaterBlockVerticalRange;
    }

    return {
        min: stackHeight - waterBlockBottomOverlap,
        max: stackHeight + waterHeight - waterBlockBottomOverlap,
    } satisfies WaterBlockVerticalRange;
}

export function getWaterBlockCenterY({
    block,
    blockData,
    stack,
}: {
    block: Block;
    blockData: BlockData[] | null | undefined;
    stack: Stack;
}) {
    const range = getWaterBlockVerticalRange({ block, blockData, stack });

    if (!range) {
        return 0;
    }

    return (range.min + range.max) / 2;
}
