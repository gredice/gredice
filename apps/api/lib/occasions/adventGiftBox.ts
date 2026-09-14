import type { OperationData, PlantSortData } from '@gredice/directory-types';
import {
    addInventoryItem,
    deleteGardenStack,
    type GardenPlacementTransaction,
    getEntitiesFormatted,
    getGardenMutationAuthorityForUpdate,
    getGardenPlacementSnapshotForUpdate,
    listGardenStructuresForUpdate,
    softDeleteGardenBlockOnce,
    updateGardenStack,
    withAccountDeletionFenceTransaction,
    withGardenMutationOperation,
    withGardenPlacementTransaction,
    withInventoryAccountTransaction,
} from '@gredice/storage';
import { getBlockData } from '../blocks/blockDataService';
import { validatePersistedStructuresAfterBlockMutation } from '../garden/gardenOccupancyService';
import { isAdventSeasonOver } from './advent2025';
import {
    type AdventGiftBoxDependencies,
    createAdventGiftBoxService,
    type GiftBoxReward,
    type GiftBoxRewardCatalog,
} from './adventGiftBoxService';

function pickRandomItem<T>(items: readonly T[]): T {
    if (!items.length) {
        throw new Error('Cannot pick a random item from an empty array.');
    }
    return items[Math.floor(Math.random() * items.length)];
}

async function loadGiftBoxRewardCatalog(): Promise<GiftBoxRewardCatalog> {
    const [plantSorts, operations] = await Promise.all([
        getEntitiesFormatted<PlantSortData>('plantSort'),
        getEntitiesFormatted<OperationData>('operation'),
    ]);

    return {
        plants: (plantSorts ?? []).map((plantSort) => ({
            entityId: plantSort.id,
            title: plantSort.information?.name ?? 'Nova biljka',
        })),
        operations: (operations ?? []).map((operation) => ({
            entityId: operation.id,
            title:
                operation.information?.label ??
                operation.information?.name ??
                'Nova radnja',
        })),
    };
}

function pickGiftBoxReward(catalog: GiftBoxRewardCatalog): GiftBoxReward {
    const { operations, plants } = catalog;

    const availableKinds: GiftBoxReward['kind'][] = [];
    if (plants.length) {
        availableKinds.push('plant');
    }
    if (operations.length) {
        availableKinds.push('operation');
    }

    if (availableKinds.length === 0) {
        throw new Error('No gift rewards available.');
    }

    const kind = pickRandomItem(availableKinds);
    if (kind === 'plant') {
        const plant = pickRandomItem(plants);
        if (plant.entityId === undefined || plant.entityId === null) {
            throw new Error('Selected plant sort has no ID.');
        }
        return {
            kind: 'plant',
            entityTypeName: 'plantSort',
            entityId: String(plant.entityId),
            title: plant.title,
        };
    }

    const operation = pickRandomItem(operations);
    if (operation.entityId === undefined || operation.entityId === null) {
        throw new Error('Selected operation has no ID.');
    }
    return {
        kind: 'operation',
        entityTypeName: 'operation',
        entityId: String(operation.entityId),
        title: operation.title,
    };
}

export const openAdventGiftBox = createAdventGiftBoxService({
    addInventoryItem,
    deleteGardenStack,
    getGardenPlacementSnapshotForUpdate,
    getGardenMutationAuthorityForUpdate,
    getBlockData,
    isAdventSeasonOver,
    listGardenStructuresForUpdate,
    loadGiftBoxRewardCatalog,
    pickGiftBoxReward,
    softDeleteGardenBlockOnce,
    updateGardenStack,
    validatePersistedStructuresAfterBlockMutation,
    withAccountDeletionFenceTransaction,
    withGardenMutationOperation: (input, callback, transaction) =>
        withGardenMutationOperation(input, callback, transaction),
    withGardenPlacementTransaction,
    withInventoryAccountTransaction,
} satisfies AdventGiftBoxDependencies<GardenPlacementTransaction>);
