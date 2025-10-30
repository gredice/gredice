import type { AppType } from 'api/routes';
import { hc, type InferResponseType } from 'hono/client';
import { createDevSafeFetch, getAppUrl, getAuthHeaders } from './shared';

function clientAuth() {
    const authorization = getAuthHeaders();
    if (!authorization) {
        return {};
    }

    return {
        headers: {
            authorization,
        },
    };
}

export function client(authRequired = false) {
    const auth = clientAuth();
    if (authRequired && !auth.headers) {
        throw new Error(
            'Authentication is required but no auth data available',
        );
    }
    return hc<AppType>(getAppUrl(), {
        ...auth,
        fetch: createDevSafeFetch(),
    });
}

export type GardenResponse = InferResponseType<
    ReturnType<typeof client>['api']['gardens'][':gardenId']['$get'],
    200
>;
