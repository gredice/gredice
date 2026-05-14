import type { PlantData, PlantSortData } from '@gredice/client';
import type { ShoppingCartItemData } from '../../../packages/game/src/hooks/useShoppingCart';

const now = '2026-05-13T00:00:00.000Z';

const tomatoPlant = {
    id: 1,
    entityType: { id: 1, name: 'plant', label: 'Biljka' },
    calendar: { harvest: [] },
    information: {
        name: 'Rajčica',
        latinName: 'Solanum lycopersicum',
        origin: 'Mock',
        description: 'Mock plant for HUD tests.',
        soilPreparation: '',
        growth: '',
        maintenance: '',
        watering: '',
        harvest: '',
        storage: '',
        operations: [],
    },
    attributes: {
        yieldMin: 1000,
        yieldMax: 2000,
        harvestWindowMin: 14,
        harvestWindowMax: 30,
        soil: 'Srednje',
        light: 1,
        seedingDepth: 1,
        nutrients: 'Srednje',
        water: 'Vlažno',
        seedingDistance: 30,
        germinationType: 'Klijanje pod svijetlosti',
        gernimationTemperature: 20,
        germinationWindowMin: 5,
        germinationWindowMax: 10,
        growthWindowMin: 60,
        growthWindowMax: 90,
        yieldType: 'perField',
        cleanHarvest: true,
    },
    image: { cover: { url: '' } },
    prices: { perPlant: 1.5 },
    store: { availableInStore: true },
    createdAt: now,
    updatedAt: now,
    isRecommended: true,
} satisfies PlantData & { isRecommended: boolean };

const basilPlant = {
    ...tomatoPlant,
    id: 2,
    information: {
        ...tomatoPlant.information,
        name: 'Bosiljak',
        latinName: 'Ocimum basilicum',
    },
    isRecommended: false,
} satisfies PlantData & { isRecommended: boolean };

const lettucePlant = {
    ...tomatoPlant,
    id: 3,
    information: {
        ...tomatoPlant.information,
        name: 'Zelena salata',
        latinName: 'Lactuca sativa',
    },
    isRecommended: false,
} satisfies PlantData & { isRecommended: boolean };

const tomatoSort = {
    id: 101,
    entityType: { id: 11, name: 'plantSort', label: 'Sorta biljke' },
    information: {
        plant: tomatoPlant,
        name: 'Cherry rajčica',
        shortDescription: 'Mock plant sort.',
    },
    image: { cover: { url: '' } },
    store: { availableInStore: true },
    attributes: { reproductionType: 'seed' },
    createdAt: now,
    updatedAt: now,
} satisfies PlantSortData;

const basilSort = {
    ...tomatoSort,
    id: 102,
    information: {
        plant: basilPlant,
        name: 'Klasični bosiljak',
        shortDescription: 'Mock basil sort.',
    },
} satisfies PlantSortData;

const lettuceSort = {
    ...tomatoSort,
    id: 103,
    information: {
        plant: lettucePlant,
        name: 'Maslac salata',
        shortDescription: 'Mock lettuce sort.',
    },
} satisfies PlantSortData;

export const TEST_GARDEN_ID = 1;
export const TEST_RAISED_BED_ID = 1;

export const allPlants = [tomatoPlant, basilPlant, lettucePlant];
export const allSorts = [tomatoSort, basilSort, lettuceSort];

export const testSorts = {
    tomato: tomatoSort,
    basil: basilSort,
    lettuce: lettuceSort,
};

export type FieldConfig = {
    positionIndex: number;
    plantSortId?: number;
    plantStatus?: 'sowed' | 'sprouted' | 'ready' | 'died';
    plantSowDate?: string;
    plantGrowthDate?: string;
    plantReadyDate?: string;
    plantHarvestedDate?: string;
    plantDeadDate?: string;
    plantRemovedDate?: string;
    toBeRemoved?: boolean;
    active?: boolean;
    stoppedDate?: string;
};

export type RaisedBedScenario = {
    fields: FieldConfig[];
    cartItems?: ShoppingCartItemData[];
};

export function buildField(config: FieldConfig, id: number) {
    return {
        id,
        raisedBedId: TEST_RAISED_BED_ID,
        isDeleted: false,
        active: config.active ?? true,
        toBeRemoved: config.toBeRemoved ?? false,
        stoppedDate: config.stoppedDate,
        positionIndex: config.positionIndex,
        plantSortId: config.plantSortId,
        plantStatus: config.plantStatus,
        plantScheduledDate: undefined,
        plantSowDate: config.plantSowDate,
        plantGrowthDate: config.plantGrowthDate,
        plantReadyDate: config.plantReadyDate,
        plantDeadDate: config.plantDeadDate,
        plantHarvestedDate: config.plantHarvestedDate,
        plantRemovedDate: config.plantRemovedDate,
        plantCycles: [],
        assignedUserId: null,
        assignedUserIds: [],
        assignedBy: null,
        assignedAt: undefined,
        createdAt: config.plantSowDate ?? now,
        updatedAt:
            config.plantHarvestedDate ??
            config.plantRemovedDate ??
            config.plantReadyDate ??
            config.plantGrowthDate ??
            config.plantSowDate ??
            now,
    };
}

export function buildCartItem({
    id,
    sort,
    positionIndex,
    scheduledDate,
}: {
    id: number;
    sort: PlantSortData;
    positionIndex: number;
    scheduledDate?: string;
}): ShoppingCartItemData {
    return {
        id,
        cartId: 1,
        entityId: sort.id.toString(),
        entityTypeName: 'plantSort',
        gardenId: TEST_GARDEN_ID,
        raisedBedId: TEST_RAISED_BED_ID,
        positionIndex,
        additionalData: scheduledDate
            ? JSON.stringify({ scheduledDate })
            : null,
        amount: 1,
        currency: 'eur',
        status: 'new',
        isDeleted: false,
        createdAt: now,
        updatedAt: now,
        shopData: {
            name: sort.information.name,
            description: sort.information.shortDescription ?? '',
            image: '',
            price: 1.5,
        },
        entityData: sort,
    } as unknown as ShoppingCartItemData;
}
