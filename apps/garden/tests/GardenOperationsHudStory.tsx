import type { OperationData } from '@gredice/client';
import * as ReactQuery from '@tanstack/react-query';
import { NuqsTestingAdapter } from 'nuqs/adapters/testing';
import { type PropsWithChildren, useMemo } from 'react';
import { GameAnalyticsProvider } from '../../../packages/game/src/analytics/GameAnalyticsContext';
import type { ShoppingCartItemData } from '../../../packages/game/src/hooks/useShoppingCart';
import { GardenOperationsHud } from '../../../packages/game/src/hud/GardenOperationsHud';
import {
    createGameState,
    GameStateContext,
} from '../../../packages/game/src/useGameState';
import {
    buildField,
    TEST_GARDEN_ID,
    TEST_RAISED_BED_ID,
    testSorts,
} from './raisedBedFieldHudScenarios';

const now = '2026-05-13T00:00:00.000Z';
const raisedBedOrientation = 'horizontal';

export const cartOperation = {
    id: 501,
    entityType: { id: 10, name: 'operation', label: 'Radnje' },
    attributes: {
        frequency: 'once',
        stage: {
            id: 1,
            information: { name: 'growth', label: 'Rast' },
        },
        application: 'plant',
        deliverable: false,
        duration: 30,
    },
    information: {
        description: 'Mock cart operation.',
        shortDescription: 'Mock operation in cart.',
        name: 'mock-cart-watering',
        label: 'Zalijevanje u košari',
        instructions: 'Mock instructions.',
    },
    prices: {
        perOperation: 3,
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

function buildGarden() {
    return {
        id: TEST_GARDEN_ID,
        name: 'Test garden',
        stacks: [],
        location: { lat: 45.739, lon: 16.572 },
        raisedBeds: [
            {
                id: TEST_RAISED_BED_ID,
                name: 'Raised Bed 1',
                blockId: 'raised-bed-1',
                physicalId: '1',
                fields: [
                    buildField(
                        {
                            positionIndex: 2,
                            plantSortId: testSorts.tomato.id,
                            plantStatus: 'sprouted',
                            plantSowDate: now,
                            plantGrowthDate: now,
                        },
                        1,
                    ),
                ],
                appliedOperations: [],
                status: 'new',
                isValid: true,
                orientation: raisedBedOrientation,
                createdAt: now,
                updatedAt: now,
            },
        ],
    };
}

function buildOperationCartItem(): ShoppingCartItemData {
    return {
        id: 91,
        cartId: 1,
        entityId: cartOperation.id.toString(),
        entityTypeName: 'operation',
        gardenId: TEST_GARDEN_ID,
        raisedBedId: TEST_RAISED_BED_ID,
        positionIndex: 2,
        additionalData: JSON.stringify({
            scheduledDate: '2026-05-20T00:00:00.000Z',
        }),
        amount: 1,
        currency: 'eur',
        status: 'new',
        isDeleted: false,
        createdAt: now,
        updatedAt: now,
        usesInventory: false,
        inventoryAvailable: 0,
        shopData: {
            name: cartOperation.information.label,
            description: cartOperation.information.shortDescription,
            image: '',
            price: cartOperation.prices.perOperation,
            discountPrice: undefined,
            discountDescription: undefined,
        },
        entityData: cartOperation,
    };
}

function createQueryClient() {
    const queryClient = new ReactQuery.QueryClient({
        defaultOptions: {
            queries: { retry: false, staleTime: Infinity },
        },
    });
    const garden = buildGarden();
    const emptyOperationPage = {
        pages: [{ items: [], nextCursor: null, total: 0 }],
        pageParams: [0],
    };

    queryClient.setQueryData(['currentUser'], { id: 'test-user' });
    queryClient.setQueryData(['gardens'], [{ id: TEST_GARDEN_ID }]);
    queryClient.setQueryData(
        ['gardens', 'current', 'summer', TEST_GARDEN_ID],
        garden,
    );
    queryClient.setQueryData(['operations'], [cartOperation]);
    queryClient.setQueryData(['shopping-cart'], {
        id: 1,
        items: [buildOperationCartItem()],
    });
    queryClient.setQueryData(
        ['garden-operations', TEST_GARDEN_ID, false, 10],
        emptyOperationPage,
    );
    queryClient.setQueryData(
        ['garden-operations', TEST_GARDEN_ID, true, 20],
        emptyOperationPage,
    );

    return queryClient;
}

function Providers({ children }: PropsWithChildren) {
    const queryClient = useMemo(() => createQueryClient(), []);
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
        <NuqsTestingAdapter>
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

export function GardenOperationsHudStory() {
    return (
        <Providers>
            <GardenOperationsHud />
        </Providers>
    );
}
