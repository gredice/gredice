import { entities } from "../data/entities";
import type { Block } from "../types/Block";
import type { Stack } from "../types/Stack";

function getEntityByName(name: string) {
    return Object.values(entities).find(entity => entity.name === name);
}

export function stackHeight(stack: Stack | undefined, stopBlock?: Block) {
    if (!stack || stack.blocks.length <= 0) {
        return 0;
    }

    let height = 0;
    for (const block of stack.blocks) {
        if (block === stopBlock) {
            return height;
        }
        height += getEntityByName(block.name)?.height ?? 0;
    }
    return height
}