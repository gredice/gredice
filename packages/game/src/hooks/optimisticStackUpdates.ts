import type { GardenStack } from '../types/Stack';

export function rotateBlocksInStacks({
    blockIds,
    rotation,
    stacks,
}: {
    blockIds: Iterable<string>;
    rotation: number;
    stacks: GardenStack[];
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

export function updateBlockMessageInStacks({
    blockId,
    message,
    stacks,
}: {
    blockId: string;
    message: string | null;
    stacks: GardenStack[];
}) {
    let changed = false;
    const nextStacks = stacks.map((stack) => {
        const blockIndex = stack.blocks.findIndex(
            (block) => block.id === blockId,
        );
        if (blockIndex === -1) {
            return stack;
        }

        const block = stack.blocks[blockIndex];
        if (!block || (block.message ?? null) === message) {
            return stack;
        }

        const nextBlocks = [...stack.blocks];
        nextBlocks[blockIndex] = {
            ...block,
            message,
        };
        changed = true;
        return {
            ...stack,
            blocks: nextBlocks,
        };
    });

    return changed ? nextStacks : stacks;
}

export function updateBlockVariantInStacks({
    blockId,
    stacks,
    variant,
}: {
    blockId: string;
    stacks: GardenStack[];
    variant: number | null;
}) {
    let changed = false;
    const nextStacks = stacks.map((stack) => {
        const blockIndex = stack.blocks.findIndex(
            (block) => block.id === blockId,
        );
        if (blockIndex === -1) {
            return stack;
        }

        const block = stack.blocks[blockIndex];
        if (!block || (block.variant ?? null) === variant) {
            return stack;
        }

        const nextBlocks = [...stack.blocks];
        nextBlocks[blockIndex] = {
            ...block,
            variant,
        };
        changed = true;
        return {
            ...stack,
            blocks: nextBlocks,
        };
    });

    return changed ? nextStacks : stacks;
}
