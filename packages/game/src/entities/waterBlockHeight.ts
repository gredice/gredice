import type { BlockData } from '@gredice/client';
import type { Block } from '../types/Block';
import type { Stack } from '../types/Stack';
import { getBlockDataByName } from '../utils/stackHeightCore';
import { defaultWaterBlockVisualHeight } from './waterBlockGeometry';

function isEdgeOrCornerTerrainBlock(blockName: string) {
    return (
        blockName.startsWith('Block_') &&
        (blockName.endsWith('_Angle') || blockName.endsWith('_Corner'))
    );
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
    const waterBlockIndex = stack.blocks.indexOf(block);
    const supportBlock =
        waterBlockIndex > 0 ? stack.blocks[waterBlockIndex - 1] : null;

    if (!supportBlock || !isEdgeOrCornerTerrainBlock(supportBlock.name)) {
        return defaultWaterBlockVisualHeight;
    }

    return (
        getBlockDataByName(blockData, supportBlock.name)?.attributes.height ??
        defaultWaterBlockVisualHeight
    );
}
