import type { BlockData } from '@gredice/client';
import { getEffectiveGardenStackBlockHeight } from '@gredice/js/gardenBlocks';
import {
    legacyStoneCornerStairsBlockName,
    stoneCornerStairsBlockName,
} from '../entities/terrainStairs';
import type { Block } from '../types/Block';
import type { GardenStack } from '../types/Stack';

export { isEdgeOrCornerTerrainBlockName } from '@gredice/js/gardenBlocks';

export function getBlockDataByName(
    blockData: BlockData[] | null | undefined,
    name: string,
) {
    const exactBlock = blockData?.find(
        (entity) => entity.information.name === name,
    );
    const compatibilityName =
        name === legacyStoneCornerStairsBlockName
            ? stoneCornerStairsBlockName
            : name === stoneCornerStairsBlockName
              ? legacyStoneCornerStairsBlockName
              : null;
    const block =
        exactBlock ??
        (compatibilityName
            ? blockData?.find(
                  (entity) => entity.information.name === compatibilityName,
              )
            : undefined);
    if (!block) {
        console.error(`Block data not found for block with name: ${name}`);
    }
    return block;
}

export function getStackBlockHeight(
    blockData: BlockData[] | null | undefined,
    stack: GardenStack,
    block: Block,
    blockIndex = stack.blocks.indexOf(block),
) {
    return getEffectiveGardenStackBlockHeight({
        blockHeight:
            getBlockDataByName(blockData, block.name)?.attributes.height ?? 0,
        blockName: block.name,
        supportBlockName: stack.blocks[blockIndex - 1]?.name,
    });
}

export function getStackHeight(
    blockData: BlockData[] | null | undefined,
    stack: GardenStack | undefined,
    stopBlock?: Block,
) {
    if (!blockData || !stack || stack.blocks.length <= 0) {
        return 0;
    }

    let height = 0;
    for (const [blockIndex, block] of stack.blocks.entries()) {
        if (block === stopBlock) {
            return height;
        }
        height += getStackBlockHeight(blockData, stack, block, blockIndex);
    }
    return height;
}
