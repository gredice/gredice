import type { AppType } from '@gredice/api/routes';
import { hc, type InferResponseType } from 'hono/client';
import { getAppUrl, getAuthHeaders } from './shared';

function clientAuth() {
    if (typeof localStorage === 'undefined') {
        return {};
    }

    return {
        headers: {
            authorization: getAuthHeaders() ?? '',
        },
    };
}

export const client = () =>
    hc<AppType>(getAppUrl(), {
        ...clientAuth(),
    });

export type GardenResponse = InferResponseType<
    ReturnType<typeof client>['api']['gardens'][':gardenId']['$get'],
    200
>;
