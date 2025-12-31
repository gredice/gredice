import type { AppType } from 'api/routes';
import { hc, type InferResponseType } from 'hono/client';
import { createAuthFetch } from './auth/authFetch';
import { getStoredAccessToken } from './auth/tokenStore';
import { createDevSafeFetch, getAppUrl } from './shared';

export function client(authRequired = false) {
    const accessToken = getStoredAccessToken();
    if (authRequired && !accessToken) {
        throw new Error(
            'Authentication is required but no auth data available',
        );
    }
    return hc<AppType>(getAppUrl(), {
        fetch: createAuthFetch(createDevSafeFetch()),
    });
}

export type GardenResponse = InferResponseType<
    ReturnType<typeof client>['api']['gardens'][':gardenId']['$get'],
    200
>;
