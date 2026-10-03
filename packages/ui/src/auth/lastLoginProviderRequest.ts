export type OAuthProvider = 'google' | 'facebook';

export type FetchLastLogin = () => Promise<Response>;

// Share only work in progress. Never retain a hint across login/logout or
// reopening a dialog, and keep different authentication endpoints isolated.
const pendingRequests = new WeakMap<
    FetchLastLogin,
    Promise<OAuthProvider | undefined>
>();

export function getLastLoginProvider(fetchLastLogin: FetchLastLogin) {
    const pending = pendingRequests.get(fetchLastLogin);
    if (pending) return pending;

    const request = (async () => {
        const response = await fetchLastLogin();
        if (!response.ok) throw new Error('Last login hint unavailable');
        const data: unknown = await response.json();
        if (data && typeof data === 'object' && 'provider' in data) {
            if (data.provider === 'google' || data.provider === 'facebook') {
                return data.provider;
            }
        }
        return undefined;
    })().finally(() => pendingRequests.delete(fetchLastLogin));
    pendingRequests.set(fetchLastLogin, request);
    return request;
}
