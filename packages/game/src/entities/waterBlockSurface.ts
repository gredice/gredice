import type { Block } from '../types/Block';
import type { Stack } from '../types/Stack';
import { isWaterBlockName } from './waterBlockNames';

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

    return !isWaterBlockName(stack.blocks[waterBlockIndex + 1]?.name ?? '');
}
