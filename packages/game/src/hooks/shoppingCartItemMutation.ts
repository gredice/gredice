import type {
    AdvancedSowingSelectionRequestV1,
    AdvancedSowingSelectionSummaryV1,
} from '@gredice/js/plants';

const shoppingCartMutationFallbackMessage = 'Failed to set shopping cart item';

export type SetShoppingCartItemInput = {
    id?: number;
    entityTypeName: string;
    entityId: string;
    amount: number;
    gardenId?: number;
    raisedBedId?: number;
    positionIndex?: number;
    additionalData?: string | null;
    currency?: string | null;
    outletOfferId?: number;
    forceCreate?: boolean;
    advancedSowingSelection?:
        | AdvancedSowingSelectionRequestV1
        | AdvancedSowingSelectionSummaryV1;
};

export type BuildOutletCartItemPayloadInput = {
    cartItemId?: number;
    currency?: 'eur' | 'sunflower';
    gardenId: number;
    outletOfferId: number;
    plantSortId: number;
    positionIndex: number;
    raisedBedId: number;
};

export function buildOutletCartItemPayload({
    cartItemId,
    currency,
    gardenId,
    outletOfferId,
    plantSortId,
    positionIndex,
    raisedBedId,
}: BuildOutletCartItemPayloadInput): SetShoppingCartItemInput {
    return {
        ...(cartItemId === undefined ? {} : { id: cartItemId }),
        entityTypeName: 'plantSort',
        entityId: plantSortId.toString(),
        amount: 1,
        gardenId,
        raisedBedId,
        positionIndex,
        additionalData: JSON.stringify({ outletOfferId }),
        ...(currency === undefined ? {} : { currency }),
        outletOfferId,
    };
}

type ShoppingCartMutationErrorOptions = {
    code: string | null;
    message: string;
    status: number;
};

export class ShoppingCartMutationError extends Error {
    readonly code: string | null;
    readonly status: number;

    constructor({ code, message, status }: ShoppingCartMutationErrorOptions) {
        super(message);
        this.name = 'ShoppingCartMutationError';
        this.code = code;
        this.status = status;
    }
}

function stringProperty(value: unknown, key: string) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return null;
    }

    const candidate: unknown = Reflect.get(value, key);
    return typeof candidate === 'string' && candidate.trim()
        ? candidate.trim()
        : null;
}

async function responseJson(response: Response) {
    try {
        const text = (await response.text()).trim();
        if (!text) {
            return null;
        }

        const parsed: unknown = JSON.parse(text);
        return parsed;
    } catch {
        return null;
    }
}

export async function shoppingCartMutationErrorFromResponse(
    response: Response,
) {
    const body = await responseJson(response);

    return new ShoppingCartMutationError({
        code: stringProperty(body, 'code'),
        message:
            stringProperty(body, 'error') ??
            stringProperty(body, 'message') ??
            shoppingCartMutationFallbackMessage,
        status: response.status,
    });
}
