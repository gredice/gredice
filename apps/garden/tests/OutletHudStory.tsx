import * as ReactQuery from '@tanstack/react-query';
import { NuqsTestingAdapter } from 'nuqs/adapters/testing';
import { type PropsWithChildren, useMemo } from 'react';
import { GameAnalyticsProvider } from '../../../packages/game/src/analytics/GameAnalyticsContext';
import { currentGardenKeys } from '../../../packages/game/src/hooks/useCurrentGarden';
import type { OutletOfferData } from '../../../packages/game/src/hooks/useOutletOffers';
import { OutletHud } from '../../../packages/game/src/hud/OutletHud';
import {
    createGameState,
    GameStateContext,
} from '../../../packages/game/src/useGameState';

const now = '2026-07-01T00:00:00.000Z';
const TEST_GARDEN_ID = 1;

const outletOffers = [
    {
        id: 301,
        plantSort: {
            id: 101,
            name: 'Rajčica mini red cherry',
            description: 'Mock outlet tomato.',
            imageUrl: null,
            plant: { id: 1, name: 'Rajčica' },
        },
        sowingDate: '2026-04-28T00:00:00.000Z',
        initialPlantStatus: 'sprouted',
        imageUrls: [],
        outletPrice: 2.99,
        comparePrice: 3.99,
        quantity: 1,
        remainingQuantity: 1,
        reservedQuantity: 0,
        soldQuantity: 0,
        startAt: '2026-07-01T00:00:00.000Z',
        endAt: '2026-07-08T00:00:00.000Z',
        url: 'https://www.gredice.test/outlet?offer=301',
    },
    {
        id: 302,
        plantSort: {
            id: 102,
            name: 'Paprika Zlata Snack Paprika',
            description: 'Mock outlet pepper.',
            imageUrl: null,
            plant: { id: 2, name: 'Paprika' },
        },
        sowingDate: '2026-06-29T00:00:00.000Z',
        initialPlantStatus: 'sprouted',
        imageUrls: [],
        outletPrice: 2.99,
        comparePrice: 3.99,
        quantity: 3,
        remainingQuantity: 3,
        reservedQuantity: 0,
        soldQuantity: 0,
        startAt: '2026-07-01T00:00:00.000Z',
        endAt: '2026-07-08T00:00:00.000Z',
        url: 'https://www.gredice.test/outlet?offer=302',
    },
] satisfies OutletOfferData[];

function emptyField(positionIndex: number) {
    return {
        id: positionIndex + 1,
        positionIndex,
        active: false,
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
    };
}

function plantedField(positionIndex: number, plantSortId: number) {
    return {
        ...emptyField(positionIndex),
        active: true,
        plantSortId,
        plantStatus: 'sowed',
    };
}

function createOutletHudQueryClient() {
    const queryClient = new ReactQuery.QueryClient({
        defaultOptions: {
            queries: { retry: false, staleTime: Infinity },
        },
    });
    const garden = {
        id: TEST_GARDEN_ID,
        name: 'Test garden',
        isSandbox: false,
        backgroundPalette: 'default',
        farmId: null,
        location: { lat: 45.739, lon: 16.572 },
        raisedBeds: [
            {
                id: 11,
                name: 'Aktivna gredica',
                blockId: 'raised-bed-active',
                physicalId: 'A1',
                fields: [
                    plantedField(0, 901),
                    ...Array.from({ length: 8 }, (_, index) =>
                        emptyField(index + 1),
                    ),
                ],
                appliedOperations: [],
                weedState: null,
                status: 'active',
                abandonReason: null,
                isValid: true,
                orientation: 'horizontal',
                createdAt: now,
                updatedAt: now,
            },
            {
                id: 12,
                name: 'Nova gredica',
                blockId: 'raised-bed-new',
                physicalId: 'N1',
                fields: Array.from({ length: 9 }, (_, index) =>
                    emptyField(index),
                ),
                appliedOperations: [],
                weedState: null,
                status: 'new',
                abandonReason: null,
                isValid: true,
                orientation: 'horizontal',
                createdAt: now,
                updatedAt: now,
            },
        ],
        stacks: [
            {
                position: { x: 0, y: 0, z: 0 },
                blocks: [
                    {
                        id: 'raised-bed-active',
                        name: 'Raised_Bed',
                        rotation: 0,
                    },
                ],
            },
            {
                position: { x: 2, y: 0, z: 0 },
                blocks: [
                    { id: 'raised-bed-new', name: 'Raised_Bed', rotation: 0 },
                ],
            },
        ],
    };

    queryClient.setQueryData(['currentUser'], { id: 'test-user' });
    queryClient.setQueryData(
        ['gardens'],
        [{ id: TEST_GARDEN_ID, name: 'Test garden', isSandbox: false }],
    );
    queryClient.setQueryData(
        currentGardenKeys('summer', TEST_GARDEN_ID),
        garden,
    );
    queryClient.setQueryData(['outlet-offers'], outletOffers);
    queryClient.setQueryData(['shopping-cart'], {
        allowPurchase: true,
        hasDeliverableItems: false,
        id: 1,
        items: [],
        notes: [],
        total: 0,
        totalSunflowers: 0,
    });

    return queryClient;
}

function OutletHudTestProviders({
    children,
    searchParams = 'vrt=1&outlet=1',
}: PropsWithChildren<{ searchParams?: string }>) {
    const queryClient = useMemo(() => createOutletHudQueryClient(), []);
    const gameStore = useMemo(
        () =>
            createGameState({
                appBaseUrl: 'http://localhost',
                freezeTime: new Date('2026-07-01T12:00:00.000Z'),
                isMock: false,
                winterMode: 'summer',
            }),
        [],
    );

    return (
        <NuqsTestingAdapter hasMemory searchParams={searchParams}>
            <ReactQuery.QueryClientProvider client={queryClient}>
                <GameStateContext.Provider value={gameStore}>
                    <GameAnalyticsProvider capture={() => undefined}>
                        {children}
                    </GameAnalyticsProvider>
                </GameStateContext.Provider>
            </ReactQuery.QueryClientProvider>
        </NuqsTestingAdapter>
    );
}

export function OutletHudStory({
    searchParams,
}: {
    searchParams?: string;
} = {}) {
    return (
        <OutletHudTestProviders searchParams={searchParams}>
            <OutletHud />
        </OutletHudTestProviders>
    );
}
