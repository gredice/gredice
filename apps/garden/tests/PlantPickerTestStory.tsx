import type { FavoriteItem, PlantData, PlantSortData } from '@gredice/client';
import * as ReactQuery from '@tanstack/react-query';
import { NuqsTestingAdapter } from 'nuqs/adapters/testing';
import { type PropsWithChildren, useEffect, useMemo } from 'react';
import { favoritesQueryKey } from '../../../packages/game/src/hooks/useFavorites';
import type { OutletOfferData } from '../../../packages/game/src/hooks/useOutletOffers';
import { PlantPicker } from '../../../packages/game/src/hud/raisedBed/RaisedBedPlantPicker';
import {
    createGameState,
    GameStateContext,
} from '../../../packages/game/src/useGameState';

const now = '2026-05-13T00:00:00.000Z';

declare global {
    interface Window {
        __grediceRemoveOutlet302?: () => void;
    }
}

const tomatoPlant = {
    id: 1,
    entityType: {
        id: 1,
        name: 'plant',
        label: 'Biljka',
    },
    slug: 'mock-tomato',
    calendar: {
        sowing: [],
        harvest: [],
    },
    information: {
        name: 'Rajčica',
        alternativeName: ['Paradajz', 'Pomidor'],
        latinName: 'Solanum lycopersicum',
        origin: 'Mock',
        description: 'Mock plant for sowing picker tests.',
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
        harvestWindowMin: 1,
        harvestWindowMax: 2,
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
        maxHarvestDaysBeforeDelivery: 0,
    },
    image: {
        cover: {
            url: '',
        },
    },
    prices: {
        perPlant: 1.5,
    },
    store: {
        availableInStore: true,
    },
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
        alternativeName: ['Bazilikum'],
        latinName: 'Ocimum basilicum',
    },
    isRecommended: false,
} satisfies PlantData & { isRecommended: boolean };

const tomatoSort = {
    id: 101,
    entityType: {
        id: 11,
        name: 'plantSort',
        label: 'Sorta biljke',
    },
    slug: 'mock-cherry-tomato',
    information: {
        plant: tomatoPlant,
        name: 'Cherry rajčica',
        shortDescription: 'Mock plant sort.',
    },
    image: {
        cover: {
            url: '',
        },
    },
    store: {
        availableInStore: true,
    },
    attributes: {
        reproductionType: 'seed',
    },
    createdAt: now,
    updatedAt: now,
} satisfies PlantSortData;

function createTomatoSort(id: number, name: string, shortDescription: string) {
    return {
        ...tomatoSort,
        id,
        slug: `mock-${id}`,
        information: {
            ...tomatoSort.information,
            name,
            shortDescription,
        },
    } satisfies PlantSortData;
}

const tomatoSorts = [
    tomatoSort,
    createTomatoSort(
        102,
        'Rajčica saint pierre',
        'Klasična visoka rajčica okruglih crvenih plodova, pogodna za svježu potrošnju.',
    ),
    createTomatoSort(
        103,
        'Rajčica scatolone',
        'Unikatna talijanska sorta. Na visokoj i bujnoj stabljici rastu krupni plodovi.',
    ),
    createTomatoSort(
        104,
        'Rajčica Volovsko srce',
        'Sorta kasne rajčice. Biljke su visoke i bujne te zahtijevaju potporu.',
    ),
    createTomatoSort(
        105,
        'Rajčica San Marzano',
        'Duguljasta rajčica punog okusa za umake, salate i ljetnu kuhinju.',
    ),
];

const tomatoOutletOffers = [
    {
        id: 301,
        plantSort: {
            id: tomatoSort.id,
            name: tomatoSort.information.name,
            description: tomatoSort.information.shortDescription,
            imageUrl: null,
            plant: {
                id: tomatoPlant.id,
                name: tomatoPlant.information.name,
            },
        },
        sowingDate: '2026-04-01T00:00:00.000Z',
        initialPlantStatus: 'sprouted',
        imageUrls: [],
        outletPrice: 1.2,
        comparePrice: 1.5,
        quantity: 2,
        remainingQuantity: 2,
        reservedQuantity: 0,
        soldQuantity: 0,
        startAt: '2026-05-01T00:00:00.000Z',
        endAt: '2026-06-01T00:00:00.000Z',
        url: 'https://www.gredice.test/outlet?offer=301',
    },
    {
        id: 302,
        plantSort: {
            id: tomatoSort.id,
            name: tomatoSort.information.name,
            description: tomatoSort.information.shortDescription,
            imageUrl: null,
            plant: {
                id: tomatoPlant.id,
                name: tomatoPlant.information.name,
            },
        },
        sowingDate: '2026-04-15T00:00:00.000Z',
        initialPlantStatus: 'sprouted',
        imageUrls: [],
        outletPrice: 1.3,
        comparePrice: 1.5,
        quantity: 3,
        remainingQuantity: 3,
        reservedQuantity: 0,
        soldQuantity: 0,
        startAt: '2026-05-01T00:00:00.000Z',
        endAt: '2026-06-15T00:00:00.000Z',
        url: 'https://www.gredice.test/outlet?offer=302',
    },
] satisfies OutletOfferData[];

type TestInventoryItem = {
    entityTypeName: string;
    entityId: string;
    amount: number;
};

type TestAdvancedSowingRange = {
    maxDistanceCm?: number;
    minDistanceCm?: number;
};

export type TestShoppingCartItem = Record<string, unknown> & {
    entityId: string;
    entityTypeName: 'plantSort';
    gardenId: number;
    id: number;
    positionIndex: number;
    raisedBedId: number;
    status: 'new';
};

function createPlantPickerQueryClient({
    advancedSowingRange,
    cartItems = [],
    favorites = [],
    fieldPositionIndices = Array.from({ length: 18 }, (_, index) => index),
    inventoryItems = [],
    plantings = [],
    propagatingRanges,
}: {
    advancedSowingRange?: TestAdvancedSowingRange;
    cartItems?: TestShoppingCartItem[];
    favorites?: FavoriteItem[];
    fieldPositionIndices?: number[];
    inventoryItems?: TestInventoryItem[];
    plantings?: unknown[];
    propagatingRanges?: PlantData['calendar']['propagating'];
} = {}) {
    const queryClient = new ReactQuery.QueryClient({
        defaultOptions: {
            queries: {
                retry: false,
            },
        },
    });
    const garden = {
        id: 1,
        name: 'Mock vrt',
        stacks: [],
        location: { lat: 45.739, lon: 16.572 },
        raisedBeds: [
            {
                id: 1,
                name: 'Mock gredica',
                blockId: 'raised-bed-1',
                physicalId: '1',
                fields: fieldPositionIndices.map((positionIndex) => ({
                    id: positionIndex + 1,
                    positionIndex,
                    active: true,
                    plantSortId: null,
                    plantStatus: null,
                    plantSowedAt: null,
                    plantReadyToHarvestAt: null,
                    plantHarvestedAt: null,
                    plantRemovedAt: null,
                    plantSort: null,
                    plantStage: null,
                    plantStageId: null,
                    plantStageUpdatedAt: null,
                    plantSowingLocation: 'direct',
                })),
                appliedOperations: [],
                plantings,
                status: 'new' as const,
                abandonReason: null,
                isValid: true,
                orientation: 'horizontal' as const,
                createdAt: now,
                updatedAt: now,
            },
        ],
    };

    queryClient.setQueryData(['currentUser'], { id: 'test-user' });
    queryClient.setQueryData(
        ['gardens'],
        [{ id: 1, name: 'Mock vrt', isSandbox: false, createdAt: now }],
    );
    queryClient.setQueryData(['gardens', 'current', 'summer', 1], garden);
    queryClient.setQueryData(['shopping-cart'], {
        allowPurchase: true,
        hasDeliverableItems: false,
        id: 1,
        items: cartItems,
        notes: [],
        total: 0,
        totalSunflowers: 0,
    });
    queryClient.setQueryData(['inventory'], {
        items: inventoryItems,
    });
    queryClient.setQueryData(['outlet-offers'], tomatoOutletOffers);
    queryClient.setQueryData(favoritesQueryKey, favorites);
    const calendarTomatoPlant =
        propagatingRanges === undefined
            ? tomatoPlant
            : {
                  ...tomatoPlant,
                  calendar: {
                      ...tomatoPlant.calendar,
                      propagating: propagatingRanges,
                  },
              };
    const advancedSowingTomatoPlant = advancedSowingRange
        ? {
              ...calendarTomatoPlant,
              attributes: {
                  ...calendarTomatoPlant.attributes,
                  seedingDistanceMax: advancedSowingRange.maxDistanceCm,
                  seedingDistanceMin: advancedSowingRange.minDistanceCm,
              },
          }
        : calendarTomatoPlant;
    const advancedSowingTomatoSorts = tomatoSorts.map((sort) => ({
        ...sort,
        information: {
            ...sort.information,
            plant: advancedSowingTomatoPlant,
        },
    }));
    queryClient.setQueryData(
        ['plants'],
        [advancedSowingTomatoPlant, basilPlant],
    );
    queryClient.setQueryData(['sorts'], advancedSowingTomatoSorts);

    return queryClient;
}

function PlantPickerTestProviders({
    advancedSowingRange,
    cartItems = [],
    children,
    favorites = [],
    fieldPositionIndices,
    inventoryItems = [],
    plantings = [],
    propagatingRanges,
    searchParams,
}: PropsWithChildren<{
    advancedSowingRange?: TestAdvancedSowingRange;
    cartItems?: TestShoppingCartItem[];
    favorites?: FavoriteItem[];
    fieldPositionIndices?: number[];
    inventoryItems?: TestInventoryItem[];
    plantings?: unknown[];
    propagatingRanges?: PlantData['calendar']['propagating'];
    searchParams?: string;
}>) {
    const queryClient = useMemo(
        () =>
            createPlantPickerQueryClient({
                advancedSowingRange,
                cartItems,
                favorites,
                fieldPositionIndices,
                inventoryItems,
                plantings,
                propagatingRanges,
            }),
        [
            advancedSowingRange,
            cartItems,
            favorites,
            fieldPositionIndices,
            inventoryItems,
            plantings,
            propagatingRanges,
        ],
    );
    const gameStore = useMemo(
        () =>
            createGameState({
                appBaseUrl: 'http://localhost',
                freezeTime: new Date('2026-05-13T12:00:00.000Z'),
                isMock: false,
                winterMode: 'summer',
            }),
        [],
    );

    return (
        <NuqsTestingAdapter hasMemory searchParams={searchParams}>
            <ReactQuery.QueryClientProvider client={queryClient}>
                <GameStateContext.Provider value={gameStore}>
                    {children}
                </GameStateContext.Provider>
            </ReactQuery.QueryClientProvider>
        </NuqsTestingAdapter>
    );
}

function OutletOfferRefetchTestHook() {
    const queryClient = ReactQuery.useQueryClient();

    useEffect(() => {
        window.__grediceRemoveOutlet302 = () => {
            queryClient.setQueryData(
                ['outlet-offers'],
                tomatoOutletOffers.filter((offer) => offer.id !== 302),
            );
        };

        return () => {
            delete window.__grediceRemoveOutlet302;
        };
    }, [queryClient]);

    return null;
}

export function PlantPickerTestStory({
    advancedSowingRange,
    cartItems,
    favorites,
    fieldPositionIndices,
    inShoppingCart = false,
    inventoryItems,
    plantings,
    preselectedPlantId,
    preselectedSortId,
    propagatingRanges,
    searchParams,
    selectedCartItemId,
    showOutletRefetchControl = false,
    positionIndex = 0,
}: {
    advancedSowingRange?: TestAdvancedSowingRange;
    cartItems?: TestShoppingCartItem[];
    favorites?: FavoriteItem[];
    fieldPositionIndices?: number[];
    inShoppingCart?: boolean;
    inventoryItems?: TestInventoryItem[];
    plantings?: unknown[];
    preselectedPlantId?: number;
    preselectedSortId?: number;
    propagatingRanges?: PlantData['calendar']['propagating'];
    searchParams?: string;
    selectedCartItemId?: number;
    showOutletRefetchControl?: boolean;
    positionIndex?: number;
} = {}) {
    return (
        <PlantPickerTestProviders
            advancedSowingRange={advancedSowingRange}
            cartItems={cartItems}
            favorites={favorites}
            fieldPositionIndices={fieldPositionIndices}
            inventoryItems={inventoryItems}
            plantings={plantings}
            propagatingRanges={propagatingRanges}
            searchParams={searchParams}
        >
            {showOutletRefetchControl ? <OutletOfferRefetchTestHook /> : null}
            <PlantPicker
                gardenId={1}
                inShoppingCart={inShoppingCart}
                raisedBedId={1}
                positionIndex={positionIndex}
                selectedCartItemId={selectedCartItemId}
                selectedPlantId={preselectedPlantId}
                selectedSortId={preselectedSortId}
                trigger={<button type="button">Sijanje</button>}
            />
        </PlantPickerTestProviders>
    );
}
