import type { InferResponseType } from 'hono/client';
import { clientAuthenticated } from './hono';

type CatalogueClient = ReturnType<
    typeof clientAuthenticated
>['api']['accounts']['current']['garden-pack-catalogue'];
export type GardenPackCatalogueResponse = InferResponseType<
    CatalogueClient['$get'],
    200
>;
export type GardenPackCatalogueOffer =
    GardenPackCatalogueResponse['offers'][number];
export const gardenPackCatalogueKeys = ['garden-pack-catalogue'];
export async function getGardenPackCatalogueOffers(
    signal?: AbortSignal,
): Promise<GardenPackCatalogueResponse> {
    const response = await clientAuthenticated().api.accounts.current[
        'garden-pack-catalogue'
    ].$get({}, { init: { signal } });
    if (!response.ok)
        throw new Error('Ponudu paketa trenutačno nije moguće učitati.');
    return response.json();
}
