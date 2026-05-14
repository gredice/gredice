import type { AppType } from 'api/routes';
import { hc, type InferResponseType } from 'hono/client';
import { createDevSafeFetch, getAppUrl } from './shared';

export type ClientMode = 'authenticated' | 'public';

export type ClientOptions = {
    auth?: ClientMode;
};

function resolveClientMode(options?: boolean | ClientOptions): ClientMode {
    if (typeof options === 'boolean') {
        return options ? 'authenticated' : 'public';
    }

    return options?.auth ?? 'public';
}

function createClient(mode: ClientMode) {
    const baseFetch = createDevSafeFetch();
    const fetchWithAuthControl: typeof fetch = (input, init) => {
        const headers = new Headers(init?.headers);
        const authRequired = mode === 'authenticated';

        if (!authRequired) {
            headers.delete('Authorization');
            headers.delete('authorization');
        }

        return baseFetch(input, {
            ...init,
            headers,
            credentials: authRequired ? 'include' : 'same-origin',
        });
    };
    return hc<AppType>(getAppUrl(), {
        fetch: fetchWithAuthControl,
    });
}

export function client(options?: boolean | ClientOptions) {
    return createClient(resolveClientMode(options));
}

export function clientAuthenticated() {
    return createClient('authenticated');
}

export function clientPublic() {
    return createClient('public');
}

export type GardenResponse = InferResponseType<
    ReturnType<typeof client>['api']['gardens'][':gardenId']['$get'],
    200
>;
