import type { OperationData, PlantSortData } from '@gredice/directory-types';
import {
    addInventoryItem,
    deleteGardenStack,
    type GardenPlacementTransaction,
    getEntitiesFormatted,
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
} from './adventGiftBoxService';

function pickRandomItem<T>(items: T[]): T {
    if (!items.length) {
        throw new Error('Cannot pick a random item from an empty array.');
    }
    return items[Math.floor(Math.random() * items.length)];
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

export const openAdventGiftBox = createAdventGiftBoxService({
    addInventoryItem,
    deleteGardenStack,
    getGardenPlacementSnapshotForUpdate,
    getBlockData,
    isAdventSeasonOver,
    listGardenStructuresForUpdate,
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
