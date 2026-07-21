import * as ReactQuery from '@tanstack/react-query';
import { NuqsTestingAdapter } from 'nuqs/adapters/testing';
import { type PropsWithChildren, useMemo } from 'react';
import { GameAnalyticsProvider } from '../../../packages/game/src/analytics/GameAnalyticsContext';
import {
    type ShoppingCartData,
    type ShoppingCartItemData,
    useShoppingCart,
    useShoppingCartQueryKey,
} from '../../../packages/game/src/hooks/useShoppingCart';
import { ShoppingCartItem } from '../../../packages/game/src/hud/components/shopping-cart/ShoppingCartItem';
import {
    ShoppingCart,
    ShoppingCartHud,
} from '../../../packages/game/src/hud/ShoppingCartHud';
import {
    createGameState,
    GameStateContext,
} from '../../../packages/game/src/useGameState';

const now = '2026-05-21T00:00:00.000Z';

const cartItem = {
    id: 1,
    cartId: 1,
    entityId: 'operation-1',
    entityTypeName: 'operation',
    gardenId: null,
    raisedBedId: null,
    positionIndex: null,
    additionalData: null,
    amount: 1,
    currency: 'eur',
    status: 'new',
    isDeleted: false,
    createdAt: now,
    updatedAt: now,
    shopData: {
        name: 'Zalijevanje',
        description: 'Mock operation.',
        image: '',
        price: 2.5,
    },
    entityData: {
        id: 1,
        entityType: { id: 10, name: 'operation', label: 'Radnje' },
        slug: 'mock-watering',
        information: {
            name: 'watering',
            label: 'Zalijevanje',
            shortDescription: 'Mock operation.',
        },
    },
} as unknown as ShoppingCartItemData;

function createOperationCartItem({
    id,
    name,
    price,
}: {
    id: number;
    name: string;
    price: number;
}) {
    return {
        ...cartItem,
        id,
        entityId: `operation-${id}`,
        shopData: {
            ...cartItem.shopData,
            name,
            price,
        },
        entityData: {
            ...cartItem.entityData,
            id,
            slug: `mock-operation-${id}`,
            information: {
                ...cartItem.entityData.information,
                label: name,
                name,
            },
        },
    } as unknown as ShoppingCartItemData;
}

const basilCartItem = createOperationCartItem({
    id: 2,
    name: 'Sadnja bosiljka',
    price: 3.5,
});
const mintCartItem = createOperationCartItem({
    id: 3,
    name: 'Sadnja metvice',
    price: 4.5,
});
const onePresenceItem = [cartItem];
const twoPresenceItems = [cartItem, basilCartItem];
const basilAndMintPresenceItems = [basilCartItem, mintCartItem];
const noPresenceItems: ShoppingCartItemData[] = [];

function createOutletCartItem() {
    const plantSortItem = createPlantSortCartItem();

    return {
        ...plantSortItem,
        raisedBedId: 2,
        positionIndex: 0,
        additionalData: null,
        shopData: {
            ...plantSortItem.shopData,
            discountDescription: 'Outlet sadnica',
            discountPrice: 1.2,
        },
        outlet: {
            offerId: 1,
            reservationId: 1,
            status: 'held',
            holdExpiresAt: new Date(Date.now() + 90_000).toISOString(),
            endAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
            sowingDate: '2026-04-15T00:00:00.000Z',
            initialPlantStatus: 'sprouted',
            outletPrice: 1.2,
            comparePrice: 2.5,
            expired: false,
        },
    } as unknown as ShoppingCartItemData;
}

function createPaidCartItem() {
    return {
        ...cartItem,
        additionalData: JSON.stringify({
            scheduledDate: '2040-01-05T00:00:00.000Z',
        }),
        status: 'paid',
    } as unknown as ShoppingCartItemData;
}

function createPlantSortCartItem() {
    return {
        ...cartItem,
        entityId: '101',
        entityTypeName: 'plantSort',
        gardenId: 1,
        raisedBedId: 1,
        positionIndex: 0,
        additionalData: JSON.stringify({
            scheduledDate: '2040-01-05T00:00:00.000Z',
        }),
        shopData: {
            ...cartItem.shopData,
            name: 'Cherry rajčica',
            description: 'Mock plant sort.',
        },
        entityData: {
            id: 101,
            entityType: {
                id: 11,
                name: 'plantSort',
                label: 'Sorta biljke',
            },
            slug: 'mock-cherry-tomato',
            information: {
                name: 'Cherry rajčica',
                plant: {
                    information: {
                        name: 'Rajčica',
                    },
                    image: {
                        cover: {
                            url: '',
                        },
                    },
                },
            },
            image: {
                cover: {
                    url: '',
                },
            },
        },
    } as unknown as ShoppingCartItemData;
}

function cartTotal(items: ShoppingCartItemData[]) {
    return items.reduce(
        (total, item) =>
            total + (item.shopData.discountPrice ?? item.shopData.price ?? 0),
        0,
    );
}

function createOptimisticToggleQueryClient(items = onePresenceItem) {
    const queryClient = new ReactQuery.QueryClient({
        defaultOptions: {
            queries: { retry: false, staleTime: Infinity },
        },
    });

    queryClient.setQueryData(['currentUser'], { id: 'test-user' });
    queryClient.setQueryData(['accounts', 'current'], {
        id: 'test-account',
        name: 'Test Account',
        sunflowers: {
            amount: 8000,
            history: [],
        },
    });
    queryClient.setQueryData(['gardens'], [{ id: 1 }]);
    queryClient.setQueryData(['gardens', 'current', 'summer', 1], {
        id: 1,
        name: 'Test garden',
        stacks: [],
        location: { lat: 45.739, lon: 16.572 },
        raisedBeds: [
            {
                id: 1,
                name: 'Mock gredica',
                physicalId: '1',
            },
        ],
    });
    queryClient.setQueryData(['inventory'], { items: [] });
    queryClient.setQueryData(['shopping-cart'], {
        allowPurchase: true,
        hasDeliverableItems: false,
        id: 1,
        items,
        notes: [],
        total: cartTotal(items),
        totalSunflowers: 0,
    });

    return queryClient;
}

function ShoppingCartOptimisticToggleProviders({
    children,
    hasMemory = false,
    item,
    items,
}: PropsWithChildren<{
    hasMemory?: boolean;
    item?: ShoppingCartItemData;
    items?: ShoppingCartItemData[];
}>) {
    const initialItems = useMemo(
        () => items ?? (item ? [item] : onePresenceItem),
        [item, items],
    );
    const queryClient = useMemo(
        () => createOptimisticToggleQueryClient(initialItems),
        [initialItems],
    );
    const gameStore = useMemo(
        () =>
            createGameState({
                appBaseUrl: 'http://localhost',
                freezeTime: new Date('2026-05-21T12:00:00.000Z'),
                isMock: false,
                winterMode: 'summer',
            }),
        [],
    );

    return (
        <NuqsTestingAdapter hasMemory={hasMemory}>
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

function setPresenceItems(
    queryClient: ReactQuery.QueryClient,
    items: ShoppingCartItemData[],
) {
    queryClient.setQueryData<ShoppingCartData | null>(
        useShoppingCartQueryKey,
        (cart) =>
            cart
                ? {
                      ...cart,
                      items,
                      total: cartTotal(items),
                  }
                : cart,
    );
}

function ShoppingCartItemsPresencePanel({
    useProductionHud = false,
}: {
    useProductionHud?: boolean;
}) {
    const queryClient = ReactQuery.useQueryClient();
    const { data: cart } = useShoppingCart();

    return (
        <div className="w-[40rem] max-w-full p-8">
            <div className="flex flex-wrap gap-2 mb-4">
                <button
                    data-testid="cart-set-one"
                    type="button"
                    onClick={() =>
                        setPresenceItems(queryClient, onePresenceItem)
                    }
                >
                    Jedna stavka
                </button>
                <button
                    data-testid="cart-set-two"
                    type="button"
                    onClick={() =>
                        setPresenceItems(queryClient, twoPresenceItems)
                    }
                >
                    Dvije stavke
                </button>
                <button
                    data-testid="cart-set-basil"
                    type="button"
                    onClick={() =>
                        setPresenceItems(queryClient, [basilCartItem])
                    }
                >
                    Samo bosiljak
                </button>
                <button
                    data-testid="cart-set-basil-mint"
                    type="button"
                    onClick={() =>
                        setPresenceItems(queryClient, basilAndMintPresenceItems)
                    }
                >
                    Bosiljak i metvica
                </button>
                <button
                    data-testid="cart-set-empty"
                    type="button"
                    onClick={() =>
                        setPresenceItems(queryClient, noPresenceItems)
                    }
                >
                    Prazna košara
                </button>
            </div>
            <output data-testid="cart-source-item-ids">
                {cart?.items.map((item) => item.id).join(',') || 'empty'}
            </output>
            {useProductionHud ? (
                <ShoppingCartHud />
            ) : (
                <ShoppingCart
                    showDeliveryStep={false}
                    onShowDeliveryStepChange={() => undefined}
                />
            )}
        </div>
    );
}

function ShoppingCartOptimisticTogglePanel() {
    const { data: cart } = useShoppingCart();
    const item = cart?.items[0];

    if (!cart || !item) {
        return null;
    }

    return (
        <div className="w-[32rem] p-8">
            <ShoppingCartItem item={item} />
            <div data-testid="optimistic-cart-total">
                {cart.total.toFixed(2)} €
            </div>
            <div data-testid="optimistic-cart-sunflowers">
                {cart.totalSunflowers}
            </div>
        </div>
    );
}

export function ShoppingCartOptimisticToggleStory() {
    return (
        <ShoppingCartOptimisticToggleProviders>
            <ShoppingCartOptimisticTogglePanel />
        </ShoppingCartOptimisticToggleProviders>
    );
}

export function ShoppingCartOutletCountdownStory() {
    const item = useMemo(() => createOutletCartItem(), []);

    return (
        <ShoppingCartOptimisticToggleProviders item={item}>
            <ShoppingCartOptimisticTogglePanel />
        </ShoppingCartOptimisticToggleProviders>
    );
}

export function ShoppingCartPaidItemStory() {
    const item = useMemo(() => createPaidCartItem(), []);

    return (
        <ShoppingCartOptimisticToggleProviders item={item}>
            <ShoppingCartOptimisticTogglePanel />
        </ShoppingCartOptimisticToggleProviders>
    );
}

export function ShoppingCartPlantSortStory() {
    const item = useMemo(() => createPlantSortCartItem(), []);

    return (
        <ShoppingCartOptimisticToggleProviders item={item}>
            <ShoppingCartOptimisticTogglePanel />
        </ShoppingCartOptimisticToggleProviders>
    );
}

export function ShoppingCartItemsPresenceStory({
    initialItemCount = 1,
}: {
    initialItemCount?: 0 | 1 | 2;
}) {
    const items =
        initialItemCount === 0
            ? noPresenceItems
            : initialItemCount === 2
              ? twoPresenceItems
              : onePresenceItem;

    return (
        <ShoppingCartOptimisticToggleProviders items={items}>
            <ShoppingCartItemsPresencePanel />
        </ShoppingCartOptimisticToggleProviders>
    );
}

export function ShoppingCartHudItemsPresenceStory() {
    return (
        <ShoppingCartOptimisticToggleProviders
            hasMemory
            items={onePresenceItem}
        >
            <ShoppingCartItemsPresencePanel useProductionHud />
        </ShoppingCartOptimisticToggleProviders>
    );
}
