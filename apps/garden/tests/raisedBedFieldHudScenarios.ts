import type { OperationData, PlantData, PlantSortData } from '@gredice/client';
import type { GardenOperationItem } from '../../../packages/game/src/hooks/useGardenOperations';
import type { ShoppingCartItemData } from '../../../packages/game/src/hooks/useShoppingCart';

const now = '2026-05-13T00:00:00.000Z';

const tomatoPlant = {
    id: 1,
    entityType: { id: 1, name: 'plant', label: 'Biljka' },
    slug: 'mock-tomato',
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
    slug: 'mock-basil',
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
    slug: 'mock-lettuce',
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
    slug: 'mock-cherry-tomato',
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
    slug: 'mock-classic-basil',
    information: {
        plant: basilPlant,
        name: 'Klasični bosiljak',
        shortDescription: 'Mock basil sort.',
    },
} satisfies PlantSortData;

const lettuceSort = {
    ...tomatoSort,
    id: 103,
    slug: 'mock-butter-lettuce',
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
    plantStatus?:
        | 'new'
        | 'planned'
        | 'pendingVerification'
        | 'sowed'
        | 'sprouted'
        | 'ready'
        | 'died'
        | 'deleted'
        | 'canceled';
    plantScheduledDate?: string;
    plantSowDate?: string;
    plantGrowthDate?: string;
    plantReadyDate?: string;
    plantHarvestedDate?: string;
    plantDeadDate?: string;
    plantRemovedDate?: string;
    cancellationReason?: string;
    cancelReason?: string;
    sowingLocation?: 'direct' | 'greenhouse';
    toBeRemoved?: boolean;
    active?: boolean;
    stoppedDate?: string;
    plantCycles?: Array<{
        active?: boolean;
        aggregateId?: string;
        assignedAt?: string;
        assignedBy?: string | null;
        assignedUserId?: string | null;
        assignedUserIds?: string[];
        cancellationReason?: string;
        cancelReason?: string;
        createdAt?: string;
        endedAt?: string;
        endedEventId?: number;
        eventIds?: number[];
        plantDeadDate?: string;
        plantGrowthDate?: string;
        plantHarvestedDate?: string;
        plantPlaceEventId?: number;
        plantReadyDate?: string;
        plantRemovedDate?: string;
        plantScheduledDate?: string;
        plantSortId?: number;
        plantSowDate?: string;
        plantStatus?: string;
        positionIndex?: number;
        sowingLocation?: 'direct' | 'greenhouse';
        startedAt?: string;
        statusChanges?: Array<{ status: string; occurredAt: string }>;
        stoppedDate?: string;
        toBeRemoved?: boolean;
    }>;
};

export type RaisedBedScenario = {
    fields: FieldConfig[];
    cartItems?: ShoppingCartItemData[];
    plants?: PlantData[];
    sorts?: PlantSortData[];
    operations?: OperationData[];
    operationHistoryItems?: GardenOperationItem[];
    operationHistoryNextCursor?: number | null;
    raisedBedOperationDiaryEntries?: Array<{
        id: number;
        name: string;
        description?: string;
        status: string | null;
        timestamp: Date;
        imageUrls?: string[] | null;
        isMarkdown?: boolean;
    }>;
    operationDiaryEntries?: Array<{
        id: number;
        name: string;
        description?: string;
        status: string | null;
        timestamp: Date;
        imageUrls?: string[] | null;
        isMarkdown?: boolean;
    }>;
    raisedBedStatus?: string;
    raisedBedAbandonReason?: string | null;
    isRaisedBedValid?: boolean;
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
        plantScheduledDate: config.plantScheduledDate,
        plantSowDate: config.plantSowDate,
        plantGrowthDate: config.plantGrowthDate,
        plantReadyDate: config.plantReadyDate,
        plantDeadDate: config.plantDeadDate,
        plantHarvestedDate: config.plantHarvestedDate,
        plantRemovedDate: config.plantRemovedDate,
        cancellationReason: config.cancellationReason,
        cancelReason: config.cancelReason,
        sowingLocation: config.sowingLocation ?? 'direct',
        plantCycles: config.plantCycles ?? [],
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

export function buildOperation({
    id,
    name,
    label,
    stageName,
    stageLabel,
    relativeDays,
}: {
    id: number;
    name: string;
    label: string;
    stageName: string;
    stageLabel: string;
    relativeDays?: number;
}): OperationData {
    return {
        id,
        entityType: { id: 10, name: 'operation', label: 'Radnje' },
        slug: `mock-${name}`,
        attributes: {
            frequency: 'once',
            stage: {
                id,
                information: { name: stageName, label: stageLabel },
            },
            application: 'plant',
            deliverable: false,
            duration: 30,
            relativeDays,
        },
        information: {
            description: `${label} test description.`,
            shortDescription: `${label} test short description.`,
            name,
            label,
            instructions: `${label} test instructions.`,
        },
        prices: {
            perOperation: 0.1,
        },
        image: { cover: { url: '' } },
        conditions: {
            completionAttachImages: false,
            completionAttachImagesRequired: false,
            completionAttachNotes: false,
            completionAttachNotesRequired: false,
        },
        createdAt: now,
        updatedAt: now,
    } satisfies OperationData;
}
