import type { BlockData } from '@gredice/client';
import { Vector4 } from 'three';
import type { Block } from '../types/Block';
import type { Stack } from '../types/Stack';
import { getStackHeight } from '../utils/stackHeightCore';

export const waterBlockName = 'Block_Water';
const waterLevelEpsilon = 1e-6;

function getWaterBlockLevel({
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

    return blockData ? getStackHeight(blockData, stack, block) : blockIndex;
}

function isSameWaterLevel(left: number | null, right: number | null) {
    return (
        left !== null &&
        right !== null &&
        Math.abs(left - right) <= waterLevelEpsilon
    );
}

function hasWaterAtLevel(
    stacks: Stack[] | undefined,
    x: number,
    z: number,
    level: number | null,
    blockData: BlockData[] | null | undefined,
) {
    return stacks?.some((candidate) => {
        if (candidate.position.x !== x || candidate.position.z !== z) {
            return false;
        }

        return candidate.blocks.some(
            (block) =>
                block.name === waterBlockName &&
                isSameWaterLevel(
                    getWaterBlockLevel({ block, blockData, stack: candidate }),
                    level,
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
    const level = getWaterBlockLevel({ block, blockData, stack });
    return new Vector4(
        hasWaterAtLevel(allStacks, x - 1, z, level, blockData) ? 0 : 1,
        hasWaterAtLevel(allStacks, x + 1, z, level, blockData) ? 0 : 1,
        hasWaterAtLevel(allStacks, x, z - 1, level, blockData) ? 0 : 1,
        hasWaterAtLevel(allStacks, x, z + 1, level, blockData) ? 0 : 1,
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
    const level = getWaterBlockLevel({ block, blockData, stack });
    const hasNegXWater = hasWaterAtLevel(allStacks, x - 1, z, level, blockData);
    const hasPosXWater = hasWaterAtLevel(allStacks, x + 1, z, level, blockData);
    const hasNegZWater = hasWaterAtLevel(allStacks, x, z - 1, level, blockData);
    const hasPosZWater = hasWaterAtLevel(allStacks, x, z + 1, level, blockData);

    return new Vector4(
        !hasWaterAtLevel(allStacks, x - 1, z - 1, level, blockData) &&
            hasNegXWater &&
            hasNegZWater
            ? 1
            : 0,
        !hasWaterAtLevel(allStacks, x + 1, z - 1, level, blockData) &&
            hasPosXWater &&
            hasNegZWater
            ? 1
            : 0,
        !hasWaterAtLevel(allStacks, x - 1, z + 1, level, blockData) &&
            hasNegXWater &&
            hasPosZWater
            ? 1
            : 0,
        !hasWaterAtLevel(allStacks, x + 1, z + 1, level, blockData) &&
            hasPosXWater &&
            hasPosZWater
            ? 1
            : 0,
    );
}
