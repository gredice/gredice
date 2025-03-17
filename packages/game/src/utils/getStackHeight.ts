import { BlockData } from "../../@types/BlockData";
import { useBlockData } from "../hooks/useBlockData";
import type { Block } from "../types/Block";
import type { Stack } from "../types/Stack";

export function getBlockDataByName(blockData: BlockData[] | null | undefined, name: string) {
    const block = blockData?.find(entity => entity.information.name === name);
    if (!block) {
        console.error(`Block data not found for block with name: ${name}`);
    }
    return block;
}

export function useStackHeight(stack: Stack | undefined, stopBlock?: Block) {
    if (!stack || stack.blocks.length <= 0) {
        return 0;
    }

    const { data: blockData } = useBlockData();
    if (!blockData) {
        return 0;
    }

    let height = 0;
    for (const block of stack.blocks) {
        if (block === stopBlock) {
            return height;
        }
        height += getBlockDataByName(blockData, block.name)?.attributes.height ?? 0;
    }
    return height;
}
