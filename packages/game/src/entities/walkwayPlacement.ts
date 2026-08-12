import type { Block } from '../types/Block';
import type { Stack } from '../types/Stack';
import { waterBlockBottomOverlap } from './waterBlockGeometry';

const terrainBlockPrefix = 'Block_';

export function getWalkwayPlacementYOffset(
    stack: Stack | undefined,
    block: Block,
) {
    if (!stack) {
        return 0;
    }

    const walkwayIndex = stack.blocks.indexOf(block);
    const supportBlock = stack.blocks[walkwayIndex - 1];

    return supportBlock?.name.startsWith(terrainBlockPrefix)
        ? -waterBlockBottomOverlap
        : 0;
}
