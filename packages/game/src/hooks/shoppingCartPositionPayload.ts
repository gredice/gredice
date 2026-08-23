import type { ShoppingCartItemData } from './useShoppingCart';

export type ShoppingCartPositionCartItem = {
    id: ShoppingCartItemData['id'];
    entityId: ShoppingCartItemData['entityId'];
    entityTypeName: ShoppingCartItemData['entityTypeName'];
    amount: ShoppingCartItemData['amount'];
    gardenId?: ShoppingCartItemData['gardenId'];
    raisedBedId?: ShoppingCartItemData['raisedBedId'];
    additionalData?: ShoppingCartItemData['additionalData'];
    currency?: ShoppingCartItemData['currency'];
    outlet?: { offerId?: number | null } | null;
};

export type ShoppingCartPositionUpdatePayload = {
    id: ShoppingCartPositionCartItem['id'];
    entityId: ShoppingCartPositionCartItem['entityId'];
    entityTypeName: ShoppingCartPositionCartItem['entityTypeName'];
    amount: ShoppingCartPositionCartItem['amount'];
    gardenId?: number;
    raisedBedId?: number;
    positionIndex?: number;
    additionalData?: ShoppingCartPositionCartItem['additionalData'];
    currency?: ShoppingCartPositionCartItem['currency'];
    outletOfferId?: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function outletOfferIdFromAdditionalData(additionalData?: string | null) {
    if (!additionalData) {
        return undefined;
    }

    try {
        const parsed: unknown = JSON.parse(additionalData);
        if (!isRecord(parsed)) {
            return undefined;
        }

        return typeof parsed.outletOfferId === 'number'
            ? parsed.outletOfferId
            : undefined;
    } catch {
        return undefined;
    }
}

export function getCartItemOutletOfferId(item: ShoppingCartPositionCartItem) {
    return typeof item.outlet?.offerId === 'number'
        ? item.outlet.offerId
        : outletOfferIdFromAdditionalData(item.additionalData);
}

export function shoppingCartPositionUpdatePayload(
    item: ShoppingCartPositionCartItem,
    positionIndex: number | undefined,
): ShoppingCartPositionUpdatePayload {
    const outletOfferId = getCartItemOutletOfferId(item);

    return {
        id: item.id,
        entityTypeName: item.entityTypeName,
        entityId: item.entityId,
        amount: item.amount,
        gardenId: typeof item.gardenId === 'number' ? item.gardenId : undefined,
        raisedBedId:
            typeof item.raisedBedId === 'number' ? item.raisedBedId : undefined,
        positionIndex,
        additionalData: item.additionalData,
        currency: item.currency,
        ...(typeof outletOfferId === 'number' ? { outletOfferId } : {}),
    };
}
