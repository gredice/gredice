import type { AppType } from 'api/routes';
import { hc, type InferResponseType } from 'hono/client';
import { createDevSafeFetch, getAppUrl } from './shared';

export function client(authRequired = true) {
    const baseFetch = createDevSafeFetch();
    const fetchWithAuthControl: typeof fetch = (input, init) => {
        const headers = new Headers(init?.headers);

        if (!authRequired) {
            headers.delete('Authorization');
            headers.delete('authorization');
        }

        return baseFetch(input, {
            ...init,
            headers,
            credentials: authRequired ? 'include' : 'omit',
        });
    };
    return hc<AppType>(getAppUrl(), {
        fetch: fetchWithAuthControl,
    });
}

export type GardenResponse = InferResponseType<
    ReturnType<typeof client>['api']['gardens'][':gardenId']['$get'],
    200
>;
