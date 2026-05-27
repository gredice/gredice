import { Vector4 } from 'three';
import type { Block } from '../types/Block';
import type { Stack } from '../types/Stack';

export const waterBlockName = 'Block_Water';

function hasWaterAt(
    stacks: Stack[] | undefined,
    x: number,
    z: number,
    blockIndex: number,
) {
    return stacks?.some((candidate) => {
        if (candidate.position.x !== x || candidate.position.z !== z) {
            return false;
        }

        return candidate.blocks[blockIndex]?.name === waterBlockName;
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
    const blockIndex = stack.blocks.indexOf(block);
    if (blockIndex < 0) {
        return new Vector4(1, 1, 1, 1);
    }

    const { x, z } = stack.position;
    return new Vector4(
        hasWaterAt(allStacks, x - 1, z, blockIndex) ? 0 : 1,
        hasWaterAt(allStacks, x + 1, z, blockIndex) ? 0 : 1,
        hasWaterAt(allStacks, x, z - 1, blockIndex) ? 0 : 1,
        hasWaterAt(allStacks, x, z + 1, blockIndex) ? 0 : 1,
    );
}
