import type { Block } from '../types/Block';
import type { Stack } from '../types/Stack';
import { waterBlockBottomOverlap } from './waterBlockGeometry';
import { isWaterBlockName } from './waterBlockNames';

export function getWaterSurfacePlacementYOffset(
    stack: Stack | undefined,
    block: Block,
) {
    if (!stack) {
        return 0;
    }

    const blockIndex = stack.blocks.indexOf(block);
    const supportBlock = stack.blocks[blockIndex - 1];

    return isWaterBlockName(supportBlock?.name ?? '')
        ? -waterBlockBottomOverlap
        : 0;
}
