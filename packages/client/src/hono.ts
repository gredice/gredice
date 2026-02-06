import type { AppType } from 'api/routes';
import { hc, type InferResponseType } from 'hono/client';
import { createDevSafeFetch, getAppUrl } from './shared';

export function client(authRequired = false) {
    void authRequired;
    const baseFetch = createDevSafeFetch();
    const fetchWithCredentials: typeof fetch = (input, init) =>
        baseFetch(input, { ...init, credentials: 'include' });
    return hc<AppType>(getAppUrl(), {
        fetch: fetchWithCredentials,
    });
}

export type GardenResponse = InferResponseType<
    ReturnType<typeof client>['api']['gardens'][':gardenId']['$get'],
    200
>;
