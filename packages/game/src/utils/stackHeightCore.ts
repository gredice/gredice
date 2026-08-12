import type { BlockData } from '@gredice/client';
import {
    isTerrainStairBlockName,
    legacyStoneCornerStairsBlockName,
    stoneCornerStairsBlockName,
} from '../entities/terrainStairs';
import { isWaterBlockName } from '../entities/waterBlockNames';
import type { Block } from '../types/Block';
import type { GardenStack } from '../types/Stack';

export function isEdgeOrCornerTerrainBlockName(blockName: string) {
    return (
        blockName.startsWith('Block_') &&
        !isTerrainStairBlockName(blockName) &&
        (blockName.endsWith('_Angle') || blockName.endsWith('_Corner'))
    );
}

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

function isWaterBlockCollapsedIntoSupport(
    stack: GardenStack,
    block: Block,
    blockIndex: number,
) {
    if (!isWaterBlockName(block.name)) {
        return false;
    }

    const supportBlock = stack.blocks[blockIndex - 1];
    return supportBlock
        ? isEdgeOrCornerTerrainBlockName(supportBlock.name)
        : false;
}

export function getStackBlockHeight(
    blockData: BlockData[] | null | undefined,
    stack: GardenStack,
    block: Block,
    blockIndex = stack.blocks.indexOf(block),
) {
    if (isWaterBlockCollapsedIntoSupport(stack, block, blockIndex)) {
        return 0;
    }

    return getBlockDataByName(blockData, block.name)?.attributes.height ?? 0;
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
