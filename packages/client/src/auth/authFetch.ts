import { getAppUrl } from '../shared';
import {
    clearStoredTokens,
    getStoredAccessToken,
    getStoredRefreshToken,
    isAccessTokenExpiringSoon,
    setStoredTokens,
} from './tokenStore';

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

let refreshInFlight: Promise<string | null> | null = null;

async function refreshAccessToken(baseFetch: typeof fetch) {
    if (refreshInFlight) {
        return refreshInFlight;
    }

    const refreshToken = getStoredRefreshToken();
    if (!refreshToken) {
        return null;
    }

    refreshInFlight = (async () => {
        const response = await baseFetch(`${getAppUrl()}/api/auth/refresh`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ refreshToken }),
        });

        if (!response.ok) {
            clearStoredTokens();
            return null;
        }

        const data: unknown = await response.json();
        if (!isRecord(data)) {
            clearStoredTokens();
            return null;
        }

        const tokenValue = data.token;
        if (typeof tokenValue !== 'string') {
            clearStoredTokens();
            return null;
        }

        const refreshValue =
            typeof data.refreshToken === 'string'
                ? data.refreshToken
                : refreshToken;
        setStoredTokens({
            accessToken: tokenValue,
            refreshToken: refreshValue,
        });

        return tokenValue;
    })();

    try {
        return await refreshInFlight;
    } finally {
        refreshInFlight = null;
    }
}

async function ensureAccessToken(baseFetch: typeof fetch) {
    const accessToken = getStoredAccessToken();
    if (!accessToken) {
        return null;
    }

    if (!isAccessTokenExpiringSoon(accessToken)) {
        return accessToken;
    }

    // If token is expiring soon and refresh fails, return null instead of expired token
    const refreshed = await refreshAccessToken(baseFetch);
    return refreshed;
}

export function createAuthFetch(baseFetch: typeof fetch): typeof fetch {
    return async (input, init) => {
        const accessToken = await ensureAccessToken(baseFetch);
        const headers = new Headers(init?.headers);
        if (accessToken) {
            headers.set('authorization', `Bearer ${accessToken}`);
        }

        const nextInit = init ? { ...init, headers } : { headers };
        const response = await baseFetch(input, nextInit);

        // Prevent infinite loop: don't retry on the refresh endpoint itself
        const url = typeof input === 'string' ? input : input.url;
        const isRefreshEndpoint = url.includes('/api/auth/refresh');
        
        if (response.status === 401 && !isRefreshEndpoint) {
            const refreshed = await refreshAccessToken(baseFetch);
            if (refreshed) {
                const retryHeaders = new Headers(init?.headers);
                retryHeaders.set('authorization', `Bearer ${refreshed}`);
                const retryInit = init
                    ? { ...init, headers: retryHeaders }
                    : { headers: retryHeaders };
                // Only retry once - don't retry again if this also returns 401
                return baseFetch(input, retryInit);
            }
        }

        return response;
    };
}
