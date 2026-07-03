import type { OperationData } from '@gredice/client';
import * as ReactQuery from '@tanstack/react-query';
import { NuqsTestingAdapter } from 'nuqs/adapters/testing';
import { type PropsWithChildren, useMemo } from 'react';
import { GameAnalyticsProvider } from '../../../packages/game/src/analytics/GameAnalyticsContext';
import {
    type GardenOperationItem,
    gardenOperationsQueryKey,
} from '../../../packages/game/src/hooks/useGardenOperations';
import { operationDefinitionsQueryKey } from '../../../packages/game/src/hooks/useOperations';
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

const internalOperation = {
    ...cartOperation,
    id: 999_002,
    slug: 'mock-raised-bed-detailed-inspection',
    attributes: {
        ...cartOperation.attributes,
        application: 'raisedBedFull',
        internal: true,
    },
    information: {
        ...cartOperation.information,
        name: 'raised-bed-detailed-inspection',
        label: 'Detaljan pregled gredice',
        shortDescription: 'Interna radnja za detaljan pregled gredice.',
    },
} satisfies OperationData;

const longLabelOperation = {
    ...cartOperation,
    id: 999_003,
    slug: 'mock-surface-raised-bed-watering',
    information: {
        ...cartOperation.information,
        name: 'surface-raised-bed-watering',
        label: 'Površinsko zalijevanje gredice',
        shortDescription: 'Dugačak naziv radnje za provjeru prikaza.',
    },
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
                    buildField(
                        {
                            positionIndex: 6,
                            plantStatus: 'deleted',
                            active: false,
                            toBeRemoved: true,
                            stoppedDate: '2026-05-24T08:00:00.000Z',
                            plantCycles: [
                                {
                                    aggregateId: `${TEST_RAISED_BED_ID}|6`,
                                    positionIndex: 6,
                                    plantPlaceEventId: 301,
                                    eventIds: [301, 302],
                                    startedAt: '2026-05-24T00:00:00.000Z',
                                    endedAt: '2026-05-24T08:00:00.000Z',
                                    endedEventId: 302,
                                    active: false,
                                    plantSortId: testSorts.lettuce.id,
                                    plantStatus: 'deleted',
                                    plantScheduledDate:
                                        '2026-05-24T00:00:00.000Z',
                                    stoppedDate: '2026-05-24T08:00:00.000Z',
                                    cancellationReason:
                                        'Korisnik je otkazao sijanje.',
                                    statusChanges: [],
                                    toBeRemoved: true,
                                },
                            ],
                        },
                        3,
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
        outlet: undefined,
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
    cancellationReason,
    entityId = cartOperation.id,
    id,
    raisedBedFieldId = 1,
    status,
}: {
    cancellationReason?: string;
    entityId?: number;
    id: number;
    raisedBedFieldId?: number | null;
    status: GardenOperationItem['status'];
}): GardenOperationItem {
    const day = String(Math.max(1, 30 - (id % 20))).padStart(2, '0');
    const terminalChangedAt = `2026-05-${day}T08:00:00.000Z`;
    const terminalHistoryStatus =
        status === 'completed' || status === 'failed' || status === 'canceled'
            ? status
            : 'confirmed';

    return {
        id,
        entityId,
        entityTypeName: 'operation',
        raisedBedId: TEST_RAISED_BED_ID,
        raisedBedFieldId,
        status,
        createdAt: `2026-05-${day}T00:00:00.000Z`,
        scheduledDate: `2026-05-${day}T00:00:00.000Z`,
        scheduledAt: `2026-05-${day}T00:00:00.000Z`,
        completedAt: status === 'completed' ? terminalChangedAt : null,
        verifiedAt:
            status === 'completed' ? `2026-05-${day}T09:00:00.000Z` : null,
        canceledAt: status === 'canceled' ? terminalChangedAt : null,
        cancellationReason:
            status === 'canceled'
                ? (cancellationReason ?? 'Korisnik je otkazao radnju.')
                : null,
        imageUrls: [],
        completionNotes: `Zapis radnje ${id.toString()}.`,
        targetLabel: 'Raised Bed 1 › Polje 3',
        statusHistory: [
            { status: 'new', changedAt: `2026-05-${day}T00:00:00.000Z` },
            { status: 'planned', changedAt: `2026-05-${day}T01:00:00.000Z` },
            { status: 'assigned', changedAt: `2026-05-${day}T02:00:00.000Z` },
            {
                status: terminalHistoryStatus,
                changedAt: terminalChangedAt,
            },
        ],
    };
}

const denseHistoryStatuses: GardenOperationItem['status'][] = [
    'completed',
    'confirmed',
    'failed',
    'canceled',
];

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
                  entityId:
                      index === 0 ? longLabelOperation.id : cartOperation.id,
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
                  cancellationReason: null,
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
        ? Array.from({ length: 20 }, (_, index) => {
              return buildHudOperationItem({
                  id: 800 + index,
                  status:
                      denseHistoryStatuses[
                          index % denseHistoryStatuses.length
                      ] ?? 'completed',
              });
          })
        : [
              buildHudOperationItem({
                  id: 610,
                  status: 'confirmed',
              }),
              buildHudOperationItem({
                  entityId: internalOperation.id,
                  id: 611,
                  raisedBedFieldId: null,
                  status: 'confirmed',
              }),
          ];
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
    queryClient.setQueryData(operationDefinitionsQueryKey.all, [
        cartOperation,
        internalOperation,
        longLabelOperation,
    ]);
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
