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
    const response = await clientAuthenticated().api.accounts.current[
        'garden-packs'
    ].purchase.$post({ json: input });
    if (!response.ok) {
        const result = await response.json();
        throw new Error(
            'error' in result
                ? result.error
                : 'Kupnju paketa trenutačno nije moguće dovršiti.',
        );
    }
    return response.json();
}
