import type { InferRequestType, InferResponseType } from 'hono/client';
import { clientAuthenticated } from './hono';

type GardenPacksClient = ReturnType<
    typeof clientAuthenticated
>['api']['accounts']['current']['garden-packs'];
export type GardenPackInventoryResponse = InferResponseType<
    GardenPacksClient['$get'],
    200
>;
export type GardenPackInventoryPurchase =
    GardenPackInventoryResponse['purchases'][number];
export type GardenPackInventoryLine =
    GardenPackInventoryPurchase['lines'][number];
export type GardenPackPurchaseInput = InferRequestType<
    GardenPacksClient['purchase']['$post']
>['json'];
export type GardenPackPurchaseResponse = InferResponseType<
    GardenPacksClient['purchase']['$post'],
    200
>;
export const gardenPackInventoryKeys = { all: ['garden-pack-inventory'] };

export class GardenPackPurchaseRequestError extends Error {
    constructor(
        message: string,
        readonly status: number | null,
        readonly code: string | null = null,
        readonly serverDefinitive = true,
    ) {
        super(message);
    }
    get uncertain() {
        return (
            this.status === null ||
            this.status >= 500 ||
            [401, 403, 408, 429].includes(this.status)
        );
    }
}

export async function getGardenPackInventory(
    options: { cursor?: string; limit?: number; signal?: AbortSignal } = {},
): Promise<GardenPackInventoryResponse> {
    const response = await clientAuthenticated().api.accounts.current[
        'garden-packs'
    ].$get(
        { query: { cursor: options.cursor, limit: options.limit?.toString() } },
        { init: { signal: options.signal } },
    );
    if (!response.ok)
        throw new Error(
            'Pakete trenutačno nije moguće učitati. Pokušaj ponovno.',
        );
    return response.json();
}

export async function purchaseGardenPack(
    input: GardenPackPurchaseInput,
): Promise<GardenPackPurchaseResponse> {
    const response = await clientAuthenticated()
        .api.accounts.current['garden-packs'].purchase.$post({ json: input })
        .catch(() => {
            throw new GardenPackPurchaseRequestError(
                'Potvrda kupnje nije stigla. Provjeri isti zahtjev.',
                null,
            );
        });
    if (!response.ok) {
        const result = await response.json().catch(() => null);
        throw new GardenPackPurchaseRequestError(
            result &&
                typeof result === 'object' &&
                'error' in result &&
                typeof result.error === 'string'
                ? result.error
                : 'Kupnju paketa trenutačno nije moguće dovršiti.',
            response.status,
            result &&
                typeof result === 'object' &&
                'code' in result &&
                typeof result.code === 'string'
                ? result.code
                : null,
        );
    }
    try {
        const receipt = await response.json();
        if (
            !receipt ||
            typeof receipt !== 'object' ||
            typeof receipt.purchaseId !== 'string' ||
            !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu.test(
                receipt.purchaseId,
            ) ||
            receipt.productId !== input.productId ||
            receipt.productVersionId !== input.quote.productVersionId ||
            receipt.chargedSunflowers !== input.quote.chargedSunflowers ||
            receipt.currency !== input.quote.currency ||
            typeof receipt.replayed !== 'boolean' ||
            !Number.isSafeInteger(receipt.totalQuantity) ||
            receipt.totalQuantity < 1 ||
            receipt.totalQuantity > 1000 ||
            typeof receipt.purchasedAt !== 'string' ||
            !Number.isFinite(Date.parse(receipt.purchasedAt))
        )
            throw new Error('Unconfirmed purchase receipt');
        return receipt;
    } catch {
        throw new GardenPackPurchaseRequestError(
            'Potvrda kupnje nije stigla. Provjeri isti zahtjev.',
            null,
        );
    }
}
