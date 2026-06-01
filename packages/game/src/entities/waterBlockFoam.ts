import { Vector4 } from 'three';
import type { Block } from '../types/Block';
import type { Stack } from '../types/Stack';

export const waterBlockName = 'Block_Water';

function hasWaterAt(stacks: Stack[] | undefined, x: number, z: number) {
    return stacks?.some((candidate) => {
        if (candidate.position.x !== x || candidate.position.z !== z) {
            return false;
        }

        return candidate.blocks.some((block) => block.name === waterBlockName);
    });
}

export function resolveWaterFoamEdges({
    block,
    stack,
    stacks,
}: {
    block: Block;
    stack: Stack;
    stacks: Stack[] | undefined;
}) {
    const allStacks = stacks ?? [stack];
    if (stack.blocks.indexOf(block) < 0) {
        return new Vector4(1, 1, 1, 1);
    }

    const { x, z } = stack.position;
    return new Vector4(
        hasWaterAt(allStacks, x - 1, z) ? 0 : 1,
        hasWaterAt(allStacks, x + 1, z) ? 0 : 1,
        hasWaterAt(allStacks, x, z - 1) ? 0 : 1,
        hasWaterAt(allStacks, x, z + 1) ? 0 : 1,
    );
}

export function resolveWaterFoamCorners({
    block,
    stack,
    stacks,
}: {
    block: Block;
    stack: Stack;
    stacks: Stack[] | undefined;
}) {
    const allStacks = stacks ?? [stack];
    if (stack.blocks.indexOf(block) < 0) {
        return new Vector4(0, 0, 0, 0);
    }

    const { x, z } = stack.position;
    const hasNegXWater = hasWaterAt(allStacks, x - 1, z);
    const hasPosXWater = hasWaterAt(allStacks, x + 1, z);
    const hasNegZWater = hasWaterAt(allStacks, x, z - 1);
    const hasPosZWater = hasWaterAt(allStacks, x, z + 1);

    return new Vector4(
        !hasWaterAt(allStacks, x - 1, z - 1) && hasNegXWater && hasNegZWater
            ? 1
            : 0,
        !hasWaterAt(allStacks, x + 1, z - 1) && hasPosXWater && hasNegZWater
            ? 1
            : 0,
        !hasWaterAt(allStacks, x - 1, z + 1) && hasNegXWater && hasPosZWater
            ? 1
            : 0,
        !hasWaterAt(allStacks, x + 1, z + 1) && hasPosXWater && hasPosZWater
            ? 1
            : 0,
    );
}
