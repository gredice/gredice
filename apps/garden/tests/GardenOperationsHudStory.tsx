import type { OperationData } from '@gredice/client';
import * as ReactQuery from '@tanstack/react-query';
import { NuqsTestingAdapter } from 'nuqs/adapters/testing';
import { type PropsWithChildren, useMemo } from 'react';
import { GameAnalyticsProvider } from '../../../packages/game/src/analytics/GameAnalyticsContext';
import {
    type GardenOperationItem,
    gardenOperationsQueryKey,
} from '../../../packages/game/src/hooks/useGardenOperations';
import type { ShoppingCartItemData } from '../../../packages/game/src/hooks/useShoppingCart';
import { GardenOperationsHud } from '../../../packages/game/src/hud/GardenOperationsHud';
import {
    createGameState,
    GameStateContext,
} from '../../../packages/game/src/useGameState';
import {
    allSorts,
    buildCartItem,
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
    slug: 'mock-cart-watering',
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
                    buildField(
                        {
                            positionIndex: 5,
                            plantSortId: testSorts.basil.id,
                            plantStatus: 'planned',
                            plantScheduledDate: '2026-05-23T00:00:00.000Z',
                        },
                        2,
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

function buildOperationCartItem({
    id,
    scheduledDate,
    positionIndex,
}: {
    id: number;
    scheduledDate?: string;
    positionIndex: number;
}): ShoppingCartItemData {
    return {
        id,
        cartId: 1,
        entityId: cartOperation.id.toString(),
        entityTypeName: 'operation',
        gardenId: TEST_GARDEN_ID,
        raisedBedId: TEST_RAISED_BED_ID,
        positionIndex,
        additionalData: scheduledDate
            ? JSON.stringify({
                  scheduledDate,
              })
            : null,
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

function buildHudOperationItem({
    id,
    status,
}: {
    id: number;
    status: GardenOperationItem['status'];
}): GardenOperationItem {
    const day = String(Math.max(1, 30 - (id % 20))).padStart(2, '0');

    return {
        id,
        entityId: cartOperation.id,
        entityTypeName: 'operation',
        raisedBedId: TEST_RAISED_BED_ID,
        raisedBedFieldId: 1,
        status,
        createdAt: `2026-05-${day}T00:00:00.000Z`,
        scheduledDate: `2026-05-${day}T00:00:00.000Z`,
        scheduledAt: `2026-05-${day}T00:00:00.000Z`,
        completedAt:
            status === 'confirmed' || status === 'completed'
                ? `2026-05-${day}T08:00:00.000Z`
                : null,
        verifiedAt:
            status === 'completed' ? `2026-05-${day}T09:00:00.000Z` : null,
        canceledAt: null,
        imageUrls: [],
        completionNotes: `Zapis radnje ${id.toString()}.`,
        targetLabel: 'Raised Bed 1 › Polje 3',
        statusHistory: [
            { status: 'new', changedAt: `2026-05-${day}T00:00:00.000Z` },
            { status: 'planned', changedAt: `2026-05-${day}T01:00:00.000Z` },
            { status: 'assigned', changedAt: `2026-05-${day}T02:00:00.000Z` },
            {
                status: status === 'completed' ? 'completed' : 'confirmed',
                changedAt: `2026-05-${day}T08:00:00.000Z`,
            },
        ],
    };
}

function createQueryClient({
    denseOperations = false,
}: {
    denseOperations?: boolean;
} = {}) {
    const queryClient = new ReactQuery.QueryClient({
        defaultOptions: {
            queries: { retry: false, staleTime: Infinity },
        },
    });
    const garden = buildGarden();
    const pendingOperationItems = denseOperations
        ? Array.from({ length: 14 }, (_, index) =>
              buildHudOperationItem({
                  id: 700 + index,
                  status: index % 2 === 0 ? 'confirmed' : 'assigned',
              }),
          )
        : [
              {
                  id: 601,
                  entityId: 999_001,
                  entityTypeName: 'operation',
                  raisedBedId: TEST_RAISED_BED_ID,
                  raisedBedFieldId: 1,
                  status: 'planned',
                  createdAt: now,
                  scheduledDate: '2026-05-22T00:00:00.000Z',
                  scheduledAt: '2026-05-22T00:00:00.000Z',
                  completedAt: null,
                  verifiedAt: null,
                  canceledAt: null,
                  imageUrls: [],
                  completionNotes: null,
                  targetLabel: 'Raised Bed 1 › Polje 3',
                  statusHistory: [
                      {
                          status: 'planned',
                          changedAt: now,
                      },
                  ],
              } satisfies GardenOperationItem,
          ];
    const historyOperationItems = denseOperations
        ? Array.from({ length: 18 }, (_, index) =>
              buildHudOperationItem({
                  id: 800 + index,
                  status: index % 3 === 0 ? 'completed' : 'confirmed',
              }),
          )
        : [];
    const pendingOperationPage = {
        pages: [
            {
                items: pendingOperationItems,
                nextCursor: null,
                total: pendingOperationItems.length,
            },
        ],
        pageParams: [0],
    };
    const historyOperationPage = {
        pages: [
            {
                items: historyOperationItems,
                nextCursor: null,
                total: historyOperationItems.length,
            },
        ],
        pageParams: [0],
    };

    queryClient.setQueryData(['currentUser'], { id: 'test-user' });
    queryClient.setQueryData(['gardens'], [{ id: TEST_GARDEN_ID }]);
    queryClient.setQueryData(
        ['gardens', 'current', 'summer', TEST_GARDEN_ID],
        garden,
    );
    queryClient.setQueryData(['sorts'], allSorts);
    queryClient.setQueryData(['operations'], [cartOperation]);
    queryClient.setQueryData(['shopping-cart'], {
        id: 1,
        items: [
            buildOperationCartItem({
                id: 91,
                scheduledDate: '2026-05-20T00:00:00.000Z',
                positionIndex: 2,
            }),
            buildOperationCartItem({
                id: 92,
                positionIndex: 3,
            }),
            buildCartItem({
                id: 93,
                sort: testSorts.lettuce,
                scheduledDate: '2026-05-21T00:00:00.000Z',
                positionIndex: 4,
            }),
        ],
    });
    queryClient.setQueryData(
        gardenOperationsQueryKey({
            gardenId: TEST_GARDEN_ID,
            includeCompleted: false,
            pageSize: 10,
        }),
        pendingOperationPage,
    );
    queryClient.setQueryData(
        gardenOperationsQueryKey({
            gardenId: TEST_GARDEN_ID,
            includeCompleted: true,
            pageSize: 20,
        }),
        historyOperationPage,
    );

    return queryClient;
}

function Providers({
    children,
    denseOperations = false,
}: PropsWithChildren<{ denseOperations?: boolean }>) {
    const queryClient = useMemo(
        () => createQueryClient({ denseOperations }),
        [denseOperations],
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

export function DenseGardenOperationsHudStory() {
    return (
        <Providers denseOperations>
            <GardenOperationsHud />
        </Providers>
    );
}
