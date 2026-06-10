export const GARDEN_BOX_BLOCK_STACK_LIMIT = 6;
export const GARDEN_BOX_BLOCK_STACK_SIZE = 10;

type GardenBoxInventoryItem = {
    entityTypeName: string;
    entityId: string;
    amount: number;
};

export function getGardenBoxInventoryCapacity(items: GardenBoxInventoryItem[]) {
    const blockTotals = new Map<string, number>();

    for (const item of items) {
        if (item.entityTypeName !== 'block' || item.amount <= 0) {
            continue;
        }

        blockTotals.set(
            item.entityId,
            (blockTotals.get(item.entityId) ?? 0) + item.amount,
        );
    }

    const stackCount = blockTotals.size;
    const blockCount = Array.from(blockTotals.values()).reduce(
        (total, amount) => total + amount,
        0,
    );

    return {
        stackCount,
        maxStacks: GARDEN_BOX_BLOCK_STACK_LIMIT,
        blockCount,
        maxBlocks: GARDEN_BOX_BLOCK_STACK_LIMIT * GARDEN_BOX_BLOCK_STACK_SIZE,
    };
}

export function canAddBlockToGardenBox(
    items: GardenBoxInventoryItem[],
    entityId: string,
) {
    const blockTotals = new Map<string, number>();

    for (const item of items) {
        if (item.entityTypeName !== 'block' || item.amount <= 0) {
            continue;
        }

        blockTotals.set(
            item.entityId,
            (blockTotals.get(item.entityId) ?? 0) + item.amount,
        );
    }

    const currentAmount = blockTotals.get(entityId) ?? 0;
    if (currentAmount > 0) {
        return currentAmount < GARDEN_BOX_BLOCK_STACK_SIZE;
    }

    return blockTotals.size < GARDEN_BOX_BLOCK_STACK_LIMIT;
}
