import type { BlockData } from '@gredice/client';
import { Vector4 } from 'three';
import type { Block } from '../types/Block';
import type { Stack } from '../types/Stack';
import { getStackHeight } from '../utils/stackHeightCore';
import { waterBlockBottomOverlap } from './waterBlockGeometry';
import { getWaterBlockVisualHeight } from './waterBlockHeight';

export const waterBlockName = 'Block_Water';
const waterRangeOverlapEpsilon = 1e-6;

type WaterVerticalRange = {
    max: number;
    min: number;
};

function getFallbackWaterBlockVerticalRange(blockIndex: number) {
    return {
        min: blockIndex,
        max: blockIndex + 1,
    } satisfies WaterVerticalRange;
}

function getWaterBlockVerticalRange({
    block,
    blockData,
    stack,
}: {
    block: Block;
    blockData: BlockData[] | null | undefined;
    stack: Stack;
}) {
    const blockIndex = stack.blocks.indexOf(block);
    if (blockIndex < 0) {
        return null;
    }

    if (!blockData) {
        return getFallbackWaterBlockVerticalRange(blockIndex);
    }

    const stackHeight = getStackHeight(blockData, stack, block);
    const waterHeight = getWaterBlockVisualHeight({
        block,
        blockData,
        stack,
    });

    return {
        min: stackHeight - waterBlockBottomOverlap,
        max: stackHeight + waterHeight - waterBlockBottomOverlap,
    } satisfies WaterVerticalRange;
}

function doWaterRangesOverlap(
    left: WaterVerticalRange | null,
    right: WaterVerticalRange | null,
) {
    return (
        left !== null &&
        right !== null &&
        Math.min(left.max, right.max) - Math.max(left.min, right.min) >
            waterRangeOverlapEpsilon
    );
}

function hasOverlappingWater(
    stacks: Stack[] | undefined,
    x: number,
    z: number,
    range: WaterVerticalRange | null,
    blockData: BlockData[] | null | undefined,
) {
    return stacks?.some((candidate) => {
        if (candidate.position.x !== x || candidate.position.z !== z) {
            return false;
        }

        return candidate.blocks.some(
            (block) =>
                block.name === waterBlockName &&
                doWaterRangesOverlap(
                    getWaterBlockVerticalRange({
                        block,
                        blockData,
                        stack: candidate,
                    }),
                    range,
                ),
        );
    });
}

export function resolveWaterFoamEdges({
    block,
    blockData,
    stack,
    stacks,
}: {
    block: Block;
    blockData?: BlockData[] | null;
    stack: Stack;
    stacks: Stack[] | undefined;
}) {
    const allStacks = stacks ?? [stack];
    if (stack.blocks.indexOf(block) < 0) {
        return new Vector4(1, 1, 1, 1);
    }

    const { x, z } = stack.position;
    const range = getWaterBlockVerticalRange({ block, blockData, stack });
    return new Vector4(
        hasOverlappingWater(allStacks, x - 1, z, range, blockData) ? 0 : 1,
        hasOverlappingWater(allStacks, x + 1, z, range, blockData) ? 0 : 1,
        hasOverlappingWater(allStacks, x, z - 1, range, blockData) ? 0 : 1,
        hasOverlappingWater(allStacks, x, z + 1, range, blockData) ? 0 : 1,
    );
}

export function resolveWaterFoamCorners({
    block,
    blockData,
    stack,
    stacks,
}: {
    block: Block;
    blockData?: BlockData[] | null;
    stack: Stack;
    stacks: Stack[] | undefined;
}) {
    const allStacks = stacks ?? [stack];
    if (stack.blocks.indexOf(block) < 0) {
        return new Vector4(0, 0, 0, 0);
    }

    const { x, z } = stack.position;
    const range = getWaterBlockVerticalRange({ block, blockData, stack });
    const hasNegXWater = hasOverlappingWater(
        allStacks,
        x - 1,
        z,
        range,
        blockData,
    );
    const hasPosXWater = hasOverlappingWater(
        allStacks,
        x + 1,
        z,
        range,
        blockData,
    );
    const hasNegZWater = hasOverlappingWater(
        allStacks,
        x,
        z - 1,
        range,
        blockData,
    );
    const hasPosZWater = hasOverlappingWater(
        allStacks,
        x,
        z + 1,
        range,
        blockData,
    );

    return new Vector4(
        !hasOverlappingWater(allStacks, x - 1, z - 1, range, blockData) &&
            hasNegXWater &&
            hasNegZWater
            ? 1
            : 0,
        !hasOverlappingWater(allStacks, x + 1, z - 1, range, blockData) &&
            hasPosXWater &&
            hasNegZWater
            ? 1
            : 0,
        !hasOverlappingWater(allStacks, x - 1, z + 1, range, blockData) &&
            hasNegXWater &&
            hasPosZWater
            ? 1
            : 0,
        !hasOverlappingWater(allStacks, x + 1, z + 1, range, blockData) &&
            hasPosXWater &&
            hasPosZWater
            ? 1
            : 0,
    );
}
