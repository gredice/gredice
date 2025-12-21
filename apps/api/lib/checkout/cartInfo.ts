import {
    type EntityStandardized,
    getEntitiesFormatted,
    getInventory,
    getRaisedBed,
    type SelectShoppingCartItem,
} from '@gredice/storage';

export type ShoppingCartDiscount = {
    cartItemId: number;
    discountPrice: number;
    discountDescription: string;
};

export type ShoppingCartItemWithShopData = SelectShoppingCartItem & {
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
                    discountDescription: 'Korištenje inventara',
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
                    } trenutno nije dostupan u inventaru`,
                );
                allowPurchase = false;
            }

            return {
                ...item,
                usesInventory: wantsInventory,
                inventoryAvailable,
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
    const requiredItemsCount = Math.ceil(newRaisedBeds.length / 2) * 9;

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
            newRaisedBeds.length === 1 ? 'nove gredice' : 'novih gredica';
        notes.push(
            `${neededPlural} još ${missingItemsCount} ${plantPlural} u ovoj ili susjednoj gredici za postavljanje ${raisedBedsPlural}.`,
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
