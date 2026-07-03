import type { Stack } from '../types/Stack';

export function rotateBlocksInStacks({
    blockIds,
    rotation,
    stacks,
}: {
    blockIds: Iterable<string>;
    rotation: number;
    stacks: Stack[];
}) {
    const blockIdSet = new Set(blockIds);
    if (blockIdSet.size === 0) {
        return stacks;
    }

    let changed = false;
    const nextStacks = stacks.map((stack) => {
        let stackChanged = false;
        const nextBlocks = stack.blocks.map((block) => {
            if (!blockIdSet.has(block.id)) {
                return block;
            }
            if (block.rotation === rotation) {
                return block;
            }

            stackChanged = true;
            return {
                ...block,
                rotation,
            };
        });

        if (!stackChanged) {
            return stack;
        }

        changed = true;
        return {
            ...stack,
            blocks: nextBlocks,
        };
    });

    return changed ? nextStacks : stacks;
}
