export type OAuthProvider = 'google' | 'facebook';

export type FetchLastLogin = () => Promise<Response>;

type PendingRequest = {
    promise: Promise<OAuthProvider | undefined>;
    consumers: number;
};

// Share work only while an open dialog consumes it. A later session must not
// reuse an abandoned request, even if the old response has not arrived yet.
const pendingRequests = new WeakMap<FetchLastLogin, PendingRequest>();

export function acquireLastLoginProvider(fetchLastLogin: FetchLastLogin) {
    let pending = pendingRequests.get(fetchLastLogin);
    if (!pending) {
        const request: PendingRequest = {
            consumers: 0,
            promise: (async () => {
                const response = await fetchLastLogin();
                if (!response.ok)
                    throw new Error('Last login hint unavailable');
                const data: unknown = await response.json();
                if (data && typeof data === 'object' && 'provider' in data) {
                    if (
                        data.provider === 'google' ||
                        data.provider === 'facebook'
                    ) {
                        return data.provider;
                    }
                }
                return undefined;
            })().finally(() => {
                if (pendingRequests.get(fetchLastLogin) === request) {
                    pendingRequests.delete(fetchLastLogin);
                }
            }),
        };
        pending = request;
        pendingRequests.set(fetchLastLogin, request);
    }
    const request = pending;
    request.consumers += 1;
    let released = false;
    return {
        promise: request.promise,
        release() {
            if (released) return;
            released = true;
            request.consumers -= 1;
            if (
                request.consumers === 0 &&
                pendingRequests.get(fetchLastLogin) === request
            ) {
                pendingRequests.delete(fetchLastLogin);
            }
        },
    };
}
