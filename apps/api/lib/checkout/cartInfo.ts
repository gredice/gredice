import {
    isRaisedBedAbandoned,
    RAISED_BED_ABANDONED_ACTIONS_DISABLED_MESSAGE,
} from '@gredice/js/raisedBeds';
import {
    type EntityStandardized,
    getEntitiesFormatted,
    getInventory,
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

const RAISED_BED_BLOCKS_PER_BED = 2;
const REQUIRED_PLANT_ITEMS_PER_NEW_RAISED_BED = 9;

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

export async function getCartInfo(
    items: SelectShoppingCartItem[],
    accountId?: string,
) {
    const entityTypeNames = items.map((item) => item.entityTypeName);
    const uniqueEntityTypeNames = Array.from(new Set(entityTypeNames));
    const entitiesData = await Promise.all(
        uniqueEntityTypeNames.map(getEntitiesFormatted),
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

    const inventory = accountId ? await getInventory(accountId) : [];
    const inventoryLookup = new Map(
        inventory.map((item) => [
            `${item.entityTypeName}-${item.entityId}`,
            item.amount,
        ]),
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
            if (availableCount > 0) {
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

            if (wantsInventory && inventoryAvailable <= 0) {
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

        const hasOpenCartItems = cartItemsWithShopInfo.some(
            (item) =>
                item.status !== 'paid' && item.raisedBedId === raisedBed.id,
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

    // Minimum order (0.5 EUR)
    const totalCartValue = cartItemsWithShopInfo.reduce((sum, item) => {
        if (item.status !== 'paid' && item.currency === 'eur') {
            const price =
                item.shopData.discountPrice ?? item.shopData.price ?? 0;
            return sum + price * item.amount;
        }
        return sum;
    }, 0);
    if (totalCartValue > 0 && totalCartValue < 0.5) {
        notes.push('Minimalna vrijednost narudžbe je 0,50 €.');
        allowPurchase = false;
    }
    // --- End notes logic ---

    return {
        notes,
        allowPurchase,
        items: cartItemsWithShopInfo,
    };
}
