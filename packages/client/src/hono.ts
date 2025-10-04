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

export const client = () =>
    hc<AppType>(getAppUrl(), {
        ...clientAuth(),
        fetch: createDevSafeFetch(),
    });

export type GardenResponse = InferResponseType<
    ReturnType<typeof client>['api']['gardens'][':gardenId']['$get'],
    200
>;
