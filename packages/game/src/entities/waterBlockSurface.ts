import type { Block } from '../types/Block';
import type { Stack } from '../types/Stack';
import { waterBlockName } from './waterBlockFoam';

export function isWaterBlockTopSurfaceVisible({
    block,
    stack,
}: {
    block: Block;
    stack: Stack;
}) {
    const waterBlockIndex = stack.blocks.indexOf(block);

    if (waterBlockIndex < 0) {
        return true;
    }

    return stack.blocks[waterBlockIndex + 1]?.name !== waterBlockName;
}
