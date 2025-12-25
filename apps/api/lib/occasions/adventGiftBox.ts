import type { OperationData, PlantSortData } from '@gredice/directory-types';
import {
    addInventoryItem,
    deleteGardenBlock,
    deleteGardenStack,
    getGarden,
    getGardenBlock,
    getGardenStacks,
    getEntitiesFormatted,
    updateGardenStack,
} from '@gredice/storage';
import { isAdventSeasonOver } from './advent2025';

const GIFT_BOX_BLOCK_PREFIX = 'GiftBox_';

type GiftBoxReward = {
    kind: 'plant' | 'operation';
    entityTypeName: 'plantSort' | 'operation';
    entityId: string;
    title: string;
};

type OpenGiftBoxResult = {
    reward: GiftBoxReward;
};

type GiftBoxErrorResult = {
    errorStatus: number;
    errorMessage: string;
};

function pickRandomItem<T>(items: T[]): T {
    if (!items.length) {
        throw new Error('Cannot pick a random item from an empty array.');
    }
    return items[Math.floor(Math.random() * items.length)];
}

function isValidGiftBoxName(name: string) {
    return name.startsWith(GIFT_BOX_BLOCK_PREFIX);
}

async function pickGiftBoxReward(): Promise<GiftBoxReward> {
    const [plantSorts, operations] = await Promise.all([
        getEntitiesFormatted<PlantSortData>('plantSort'),
        getEntitiesFormatted<OperationData>('operation'),
    ]);

    const availableKinds: GiftBoxReward['kind'][] = [];
    if (plantSorts?.length) {
        availableKinds.push('plant');
    }
    if (operations?.length) {
        availableKinds.push('operation');
    }

    if (availableKinds.length === 0) {
        throw new Error('No gift rewards available.');
    }

    const kind = pickRandomItem(availableKinds);
    if (kind === 'plant') {
        const plantSort = pickRandomItem(plantSorts ?? []);
        const plantSortId = plantSort?.id;
        if (plantSortId === undefined || plantSortId === null) {
            throw new Error('Selected plant sort has no ID.');
        }
        return {
            kind: 'plant',
            entityTypeName: 'plantSort',
            entityId: String(plantSortId),
            title: plantSort.information?.name ?? 'Nova biljka',
        };
    }

    const operation = pickRandomItem(operations ?? []);
    const operationId = operation?.id;
    if (operationId === undefined || operationId === null) {
        throw new Error('Selected operation has no ID.');
    }
    return {
        kind: 'operation',
        entityTypeName: 'operation',
        entityId: String(operationId),
        title:
            operation.information?.label ??
            operation.information?.name ??
            'Nova radnja',
    };
}

export async function openAdventGiftBox({
    accountId,
    gardenId,
    blockId,
    timeZone,
}: {
    accountId: string;
    gardenId: number;
    blockId: string;
    timeZone: string;
}): Promise<OpenGiftBoxResult | GiftBoxErrorResult> {
    if (!isAdventSeasonOver(timeZone)) {
        return {
            errorStatus: 400,
            errorMessage: 'Advent još traje. Poklon kutije su dostupne 25.12.',
        };
    }

    const [garden, block, stacks] = await Promise.all([
        getGarden(gardenId),
        getGardenBlock(gardenId, blockId),
        getGardenStacks(gardenId),
    ]);

    if (!garden || garden.accountId !== accountId) {
        return { errorStatus: 404, errorMessage: 'Garden not found' };
    }
    if (!block || block.gardenId !== gardenId) {
        return { errorStatus: 404, errorMessage: 'Block not found' };
    }
    if (!isValidGiftBoxName(block.name)) {
        return {
            errorStatus: 400,
            errorMessage: 'Requested block is not a gift box.',
        };
    }

    const stack = stacks.find((candidate) =>
        candidate.blocks.includes(blockId),
    );
    if (!stack) {
        return {
            errorStatus: 404,
            errorMessage: 'Stack not found for gift box.',
        };
    }

    const reward = await pickGiftBoxReward();
    await addInventoryItem(accountId, {
        entityTypeName: reward.entityTypeName,
        entityId: reward.entityId,
        amount: 1,
        source: `advent-gift-box:${blockId}`,
    });

    const updatedBlocks = stack.blocks.filter(
        (blockIdInStack) => blockIdInStack !== blockId,
    );

    if (updatedBlocks.length === 0) {
        await deleteGardenStack(gardenId, {
            x: stack.positionX,
            y: stack.positionY,
        });
    } else {
        await updateGardenStack(gardenId, {
            x: stack.positionX,
            y: stack.positionY,
            blocks: updatedBlocks,
        });
    }

    await deleteGardenBlock(gardenId, blockId);

    return { reward };
}
