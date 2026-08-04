import {
    isRaisedBedAbandoned,
    RAISED_BED_ABANDONED_ACTIONS_DISABLED_MESSAGE,
} from '@gredice/js/raisedBeds';
import {
    minimumShoppingCartAmountCents,
    minimumShoppingCartAmountEur,
} from '@gredice/js/shoppingCart';
import {
    type CheckoutInventoryConsumption,
    type EntityStandardized,
    getCheckoutInventorySnapshot,
    getCheckoutOperationMappings,
    getEntitiesFormatted,
    getOutletOfferReservationsForCartItems,
    getRaisedBed,
    type SelectShoppingCartItem,
} from '@gredice/storage';

export type ShoppingCartDiscount = {
    cartItemId: number;
    discountPrice: number;
    discountDescription: string;
};

export type ShoppingCartItemWithShopData = SelectShoppingCartItem & {
    entityData: EntityStandardized;
    outlet?: {
        offerId: number;
        reservationId: number;
        status: string;
        holdExpiresAt: Date;
        endAt: Date;
        sowingDate: Date;
        initialPlantStatus: string;
        outletPrice: number;
        comparePrice: number | null;
        expired: boolean;
    };
    shopData: {
        name?: string;
        description?: string;
        image?: string;
        price?: number;
        discountPrice?: number;
        discountDescription?: string;
    };
    usesInventory?: boolean;
    inventoryAvailable?: number;
};

type CartValueItem = Pick<
    ShoppingCartItemWithShopData,
    'amount' | 'currency' | 'shopData' | 'status'
>;

type InventoryAvailabilityCartItem = Pick<
    SelectShoppingCartItem,
    'amount' | 'currency' | 'entityId' | 'entityTypeName' | 'id' | 'status'
>;

type InventoryAvailabilityItem = Pick<
    CheckoutInventoryConsumption,
    'amount' | 'entityId' | 'entityTypeName'
>;

const RAISED_BED_BLOCKS_PER_BED = 2;
const REQUIRED_PLANT_ITEMS_PER_NEW_RAISED_BED = 9;

function getInventoryKey(
    item: Pick<InventoryAvailabilityItem, 'entityId' | 'entityTypeName'>,
) {
    return `${item.entityTypeName}-${item.entityId}`;
}

export function getEffectiveInventoryAvailability(
    items: readonly InventoryAvailabilityCartItem[],
    inventory: readonly InventoryAvailabilityItem[],
    consumptions: readonly CheckoutInventoryConsumption[],
) {
    const itemsById = new Map(items.map((item) => [item.id, item]));
    const availability = new Map<string, number>();

    for (const item of inventory) {
        const key = getInventoryKey(item);
        availability.set(key, (availability.get(key) ?? 0) + item.amount);
    }

    for (const consumption of consumptions) {
        const expectedSource = `shoppingCartItem:${consumption.cartItemId.toString()}`;
        if (consumption.source !== expectedSource) {
            throw new Error(
                `Checkout inventory consumption source mismatch for cart item ${consumption.cartItemId.toString()}`,
            );
        }

        const cartItem = itemsById.get(consumption.cartItemId);
        if (
            cartItem?.currency !== 'inventory' ||
            cartItem.entityTypeName !== consumption.entityTypeName ||
            cartItem.entityId !== consumption.entityId
        ) {
            throw new Error(
                `Checkout inventory consumption item mismatch for cart item ${consumption.cartItemId.toString()}`,
            );
        }
        if (cartItem.amount !== consumption.amount) {
            throw new Error(
                `Checkout inventory consumption amount mismatch for cart item ${consumption.cartItemId.toString()}`,
            );
        }

        if (cartItem.status === 'paid') {
            continue;
        }

        const key = getInventoryKey(consumption);
        availability.set(
            key,
            (availability.get(key) ?? 0) + consumption.amount,
        );
    }

    return availability;
}

export function hasEnoughInventoryForCartItem(
    item: Pick<InventoryAvailabilityCartItem, 'amount' | 'status'>,
    inventoryAvailable: number,
) {
    return item.status === 'paid' || inventoryAvailable >= item.amount;
}

export function getPendingInventoryCartItemIds(
    items: readonly Pick<
        InventoryAvailabilityCartItem,
        'currency' | 'id' | 'status'
    >[],
) {
    return items
        .filter(
            (item) => item.status !== 'paid' && item.currency === 'inventory',
        )
        .map((item) => item.id);
}

export function hasBlockingOpenItemsForRaisedBed(
    items: readonly Pick<
        SelectShoppingCartItem,
        'entityTypeName' | 'id' | 'raisedBedId' | 'status'
    >[],
    raisedBedId: number,
    mappedOperationCartItemIds: ReadonlySet<number>,
    resumableCartItemIds: ReadonlySet<number> = new Set(),
) {
    return items.some(
        (item) =>
            item.status !== 'paid' &&
            item.raisedBedId === raisedBedId &&
            !resumableCartItemIds.has(item.id) &&
            !(
                item.entityTypeName === 'operation' &&
                mappedOperationCartItemIds.has(item.id)
            ),
    );
}

function getNewRaisedBedCount(newRaisedBedBlockCount: number) {
    return Math.ceil(newRaisedBedBlockCount / RAISED_BED_BLOCKS_PER_BED);
}

export function getNewRaisedBedPlantingNote(
    missingItemsCount: number,
    newRaisedBedBlockCount: number,
) {
    const newRaisedBedCount = getNewRaisedBedCount(newRaisedBedBlockCount);
    const neededPlural =
        missingItemsCount === 1
            ? 'Potrebna je'
            : missingItemsCount > 4
              ? 'Potrebno je'
              : 'Potrebne su';
    const plantPlural =
        missingItemsCount === 1
            ? 'biljka'
            : missingItemsCount > 4
              ? 'biljaka'
              : 'biljke';
    const raisedBedsPlural =
        newRaisedBedCount === 1 ? 'nove gredice' : 'novih gredica';
    const raisedBedsLocation =
        newRaisedBedCount === 1 ? 'u ovoj gredici' : 'u novim gredicama';

    return `${neededPlural} još ${missingItemsCount} ${plantPlural} ${raisedBedsLocation} za postavljanje ${raisedBedsPlural}.`;
}

export function getAbandonedRaisedBedCartNote(raisedBedName?: string | null) {
    const prefix = raisedBedName?.trim() ? raisedBedName.trim() : 'Gredica';

    return `${prefix} je napuštena zbog neaktivnosti. ${RAISED_BED_ABANDONED_ACTIONS_DISABLED_MESSAGE}`;
}

export function getTotalCartValueCents(items: CartValueItem[]) {
    return items.reduce((sum, item) => {
        if (item.status !== 'paid' && item.currency === 'eur') {
            const priceEur =
                item.shopData.discountPrice ?? item.shopData.price ?? 0;
            const priceCents = Math.round(priceEur * 100);

            return sum + priceCents * item.amount;
        }

        return sum;
    }, 0);
}

export function getMinimumOrderNote(totalCartValueCents: number) {
    if (
        totalCartValueCents <= 0 ||
        totalCartValueCents >= minimumShoppingCartAmountCents
    ) {
        return null;
    }

    return `Minimalna vrijednost narudžbe je ${minimumShoppingCartAmountEur} €.`;
}

export async function getCartInfo(
    items: SelectShoppingCartItem[],
    accountId?: string,
    {
        checkoutOperationMappings: suppliedCheckoutOperationMappings,
        resumableCartItemIds = new Set(),
    }: {
        checkoutOperationMappings?: Awaited<
            ReturnType<typeof getCheckoutOperationMappings>
        >;
        resumableCartItemIds?: ReadonlySet<number>;
    } = {},
) {
    const entityTypeNames = items.map((item) => item.entityTypeName);
    const uniqueEntityTypeNames = Array.from(new Set(entityTypeNames));
    const pendingOperationCartItemIds = items
        .filter(
            (item) =>
                item.status !== 'paid' && item.entityTypeName === 'operation',
        )
        .map((item) => item.id);
    const [entitiesData, checkoutOperationMappings] = await Promise.all([
        Promise.all(uniqueEntityTypeNames.map(getEntitiesFormatted)),
        suppliedCheckoutOperationMappings ??
            getCheckoutOperationMappings(pendingOperationCartItemIds),
    ]);
    const mappedOperationCartItemIds = new Set(
        checkoutOperationMappings.keys(),
    );
    const entitiesByTypeName = uniqueEntityTypeNames.reduce(
        (acc, typeName, index) => {
            const entities = entitiesData[index] as EntityStandardized[];
            if (!acc[typeName]) {
                acc[typeName] = [];
            }
            acc[typeName].push(...entities);
            return acc;
        },
        {} as Record<string, EntityStandardized[]>,
    );

    const discounts: ShoppingCartDiscount[] = [];
    const now = new Date();
    const outletReservations = await getOutletOfferReservationsForCartItems(
        items.map((item) => item.id),
    );
    const outletReservationsByCartItemId = new Map<
        number,
        (typeof outletReservations)[number]
    >();
    for (const reservation of outletReservations) {
        if (!outletReservationsByCartItemId.has(reservation.cartItemId)) {
            outletReservationsByCartItemId.set(
                reservation.cartItemId,
                reservation,
            );
        }
    }

    for (const reservation of outletReservations) {
        if (reservation.status !== 'held') {
            continue;
        }

        const hasExpired =
            reservation.holdExpiresAt.getTime() <= now.getTime() ||
            reservation.outletOffer.endAt.getTime() <= now.getTime();
        if (hasExpired) {
            continue;
        }

        discounts.push({
            cartItemId: reservation.cartItemId,
            discountPrice: reservation.heldOutletPriceCents / 100,
            discountDescription: 'Outlet sadnica',
        });
    }

    let inventory: InventoryAvailabilityItem[] = [];
    let checkoutInventoryConsumptions: CheckoutInventoryConsumption[] = [];
    const pendingInventoryCartItemIds = getPendingInventoryCartItemIds(items);
    if (accountId && pendingInventoryCartItemIds.length > 0) {
        const snapshot = await getCheckoutInventorySnapshot(
            accountId,
            pendingInventoryCartItemIds,
        );
        inventory = snapshot.inventory;
        checkoutInventoryConsumptions = snapshot.consumptions;
    }
    const inventoryLookup = getEffectiveInventoryAvailability(
        items,
        inventory,
        checkoutInventoryConsumptions,
    );

    // Process paid discounts for items that are already paid
    const paidItems = items.filter((item) => item.status === 'paid');
    if (paidItems.length > 0) {
        for (const item of paidItems) {
            discounts.push({
                cartItemId: item.id,
                discountPrice: 0,
                discountDescription: 'Već plaćeno',
            });
        }
    }

    // Inventory discounts (free items when available)
    for (const item of items) {
        const wantsInventory = item.currency === 'inventory';
        if (wantsInventory) {
            const availableCount =
                inventoryLookup.get(
                    `${item.entityTypeName}-${item.entityId}`,
                ) ?? 0;
            if (
                item.status !== 'paid' &&
                hasEnoughInventoryForCartItem(item, availableCount)
            ) {
                discounts.push({
                    cartItemId: item.id,
                    discountPrice: 0,
                    discountDescription: 'Korištenje iz ruksaka',
                });
            }
        }
    }

    let allowPurchase = true;
    const notes: string[] = [];

    const cartItemsWithShopInfo = items
        .map((item) => {
            const entityData = entitiesByTypeName[item.entityTypeName].find(
                (entity) => entity?.id.toString() === item.entityId,
            );
            if (!entityData) {
                console.warn('Entity not found', {
                    entityId: item.entityId,
                    entityTypeName: item.entityTypeName,
                });
                return null;
            }

            // Verify inventory item availability
            const wantsInventory = item.currency === 'inventory';
            const inventoryAvailable = wantsInventory
                ? (inventoryLookup.get(
                      `${item.entityTypeName}-${item.entityId}`,
                  ) ?? 0)
                : 0;

            if (
                wantsInventory &&
                !hasEnoughInventoryForCartItem(item, inventoryAvailable)
            ) {
                notes.push(
                    `${
                        entityData.information?.label ||
                        entityData.information?.name
                    } trenutno nije dostupan u ruksaku.`,
                );
                allowPurchase = false;
            }

            const outletReservation = outletReservationsByCartItemId.get(
                item.id,
            );
            const outletExpired = outletReservation
                ? outletReservation.status === 'held' &&
                  (outletReservation.holdExpiresAt.getTime() <= now.getTime() ||
                      outletReservation.outletOffer.endAt.getTime() <=
                          now.getTime())
                : false;

            if (
                outletReservation &&
                item.status !== 'paid' &&
                outletReservation.status === 'held' &&
                outletExpired
            ) {
                notes.push(
                    `${
                        entityData.information?.label ||
                        entityData.information?.name ||
                        'Outlet sadnica'
                    } više nije rezervirana po outlet cijeni.`,
                );
                allowPurchase = false;
            }

            return {
                ...item,
                usesInventory: wantsInventory,
                inventoryAvailable,
                entityData,
                outlet: outletReservation
                    ? {
                          offerId: outletReservation.outletOfferId,
                          reservationId: outletReservation.id,
                          status: outletReservation.status,
                          holdExpiresAt: outletReservation.holdExpiresAt,
                          endAt: outletReservation.outletOffer.endAt,
                          sowingDate: outletReservation.heldSowingDate,
                          initialPlantStatus:
                              outletReservation.heldInitialPlantStatus,
                          outletPrice:
                              outletReservation.heldOutletPriceCents / 100,
                          comparePrice:
                              typeof outletReservation.heldComparePriceCents ===
                              'number'
                                  ? outletReservation.heldComparePriceCents /
                                    100
                                  : null,
                          expired: outletExpired,
                      }
                    : undefined,
                shopData: {
                    name:
                        entityData.information?.label ??
                        entityData.information?.name,
                    description:
                        entityData.information?.shortDescription ??
                        entityData.information?.description,
                    image:
                        entityData.image?.cover?.url ??
                        entityData.images?.cover?.url ??
                        entityData.information?.plant?.image?.cover?.url ??
                        entityData.information?.plant?.images?.cover?.url,
                    price:
                        entityData.prices?.perOperation ??
                        entityData.prices?.perPlant ??
                        entityData.information?.plant?.prices?.perOperation ??
                        entityData.information?.plant?.prices?.perPlant,
                    discountPrice: discounts.find(
                        (discount) => discount.cartItemId === item.id,
                    )?.discountPrice,
                    discountDescription: discounts.find(
                        (discount) => discount.cartItemId === item.id,
                    )?.discountDescription,
                },
            };
        })
        .filter((i) => Boolean(i))
        // biome-ignore lint/style/noNonNullAssertion: Applied boolean filter line above
        .map((i) => i!)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    // --- Notes logic ---
    // Group items by raisedBedId, count items per raised bed (excluding paid items)
    // Find all 'new' raised beds
    const raisedBedItemCounts: Record<number, number> = {};
    cartItemsWithShopInfo.forEach((item) => {
        if (item.raisedBedId && item.status !== 'paid') {
            raisedBedItemCounts[item.raisedBedId] =
                (raisedBedItemCounts[item.raisedBedId] || 0) + 1;
        }
    });
    const mentionedRaisedBedIds = Array.from(
        new Set(
            cartItemsWithShopInfo
                .filter((item) => Boolean(item.raisedBedId))
                // biome-ignore lint/style/noNonNullAssertion: Applied boolean filter line above
                .map((item) => item.raisedBedId!),
        ),
    );
    const mentionedRaisedBeds = await Promise.all(
        mentionedRaisedBedIds.map((id) => getRaisedBed(id)),
    );

    const newRaisedBeds = mentionedRaisedBeds.filter(
        (rb) => rb && rb.status === 'new',
    );
    const abandonedRaisedBeds = mentionedRaisedBeds.filter(
        (rb) => rb && isRaisedBedAbandoned(rb.status),
    );
    for (const raisedBed of abandonedRaisedBeds) {
        if (!raisedBed) continue;

        const hasOpenCartItems = hasBlockingOpenItemsForRaisedBed(
            cartItemsWithShopInfo,
            raisedBed.id,
            mappedOperationCartItemIds,
            resumableCartItemIds,
        );
        if (!hasOpenCartItems) continue;

        notes.push(getAbandonedRaisedBedCartNote(raisedBed.name));
        allowPurchase = false;
    }
    const requiredItemsCount =
        getNewRaisedBedCount(newRaisedBeds.length) *
        REQUIRED_PLANT_ITEMS_PER_NEW_RAISED_BED;

    const cartItemsInNewRaisedBeds = cartItemsWithShopInfo.filter(
        (item) =>
            item.status !== 'paid' &&
            item.raisedBedId &&
            item.entityTypeName === 'plantSort' &&
            newRaisedBeds.some((rb) => rb?.id === item.raisedBedId),
    );
    if (cartItemsInNewRaisedBeds.length < requiredItemsCount) {
        const missingItemsCount =
            requiredItemsCount - cartItemsInNewRaisedBeds.length;
        notes.push(
            getNewRaisedBedPlantingNote(
                missingItemsCount,
                newRaisedBeds.length,
            ),
        );
        allowPurchase = false;
    }

    const totalCartValueCents = getTotalCartValueCents(cartItemsWithShopInfo);
    const minimumOrderNote = getMinimumOrderNote(totalCartValueCents);
    if (minimumOrderNote) {
        notes.push(minimumOrderNote);
        allowPurchase = false;
    }
    // --- End notes logic ---

    return {
        notes,
        allowPurchase,
        items: cartItemsWithShopInfo,
    };
}
