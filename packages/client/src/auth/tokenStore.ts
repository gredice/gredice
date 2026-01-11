/**
 * Note: With cookie-based authentication via the API proxy (/api/gredice/),
 * tokens are now managed via httpOnly cookies set by the server.
 * These functions are kept for backward compatibility but may not be needed
 * for the cookie-based flow. The refresh logic is handled server-side.
 */

const accessTokenKey = 'gredice-token';
const refreshTokenKey = 'gredice-refresh-token';

function hasLocalStorage() {
    return typeof localStorage !== 'undefined';
}

export function getStoredAccessToken() {
    if (!hasLocalStorage()) {
        return null;
    }
    return localStorage.getItem(accessTokenKey);
}

export function getStoredRefreshToken() {
    if (!hasLocalStorage()) {
        return null;
    }
    return localStorage.getItem(refreshTokenKey);
}

export function setStoredTokens({
    accessToken,
    refreshToken,
}: {
    accessToken?: string | null;
    refreshToken?: string | null;
}) {
    if (!hasLocalStorage()) {
        return;
    }
    if (accessToken) {
        localStorage.setItem(accessTokenKey, accessToken);
    }
    if (refreshToken) {
        localStorage.setItem(refreshTokenKey, refreshToken);
    }
}

export function clearStoredTokens() {
    if (!hasLocalStorage()) {
        return;
    }
    localStorage.removeItem(accessTokenKey);
    localStorage.removeItem(refreshTokenKey);
}

function decodeBase64Url(value: string) {
    const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
    // Calculate required base64 padding: base64 strings must be multiples of 4 characters.
    // This formula calculates how many '=' padding characters are needed:
    // - (normalized.length + 3) % 4 gives us the remainder when dividing by 4
    // - We slice '===' to get 0, 1, or 2 '=' characters as needed
    const padding = '==='.slice((normalized.length + 3) % 4);
    const padded = `${normalized}${padding}`;

    if (typeof atob === 'function') {
        return atob(padded);
    }

    if (typeof Buffer !== 'undefined') {
        return Buffer.from(padded, 'base64').toString('utf8');
    }

    return null;
}

export function getJwtExpiryMs(token: string) {
    const payload = token.split('.')[1];
    if (!payload) {
        return null;
    }
    const decoded = decodeBase64Url(payload);
    if (!decoded) {
        return null;
    }

    try {
        const parsed: unknown = JSON.parse(decoded);
        if (typeof parsed === 'object' && parsed !== null && 'exp' in parsed) {
            const expValue = parsed.exp;
            if (typeof expValue === 'number') {
                return expValue * 1000;
            }
        }
    } catch {
        return null;
    }

    return null;
}

export function isAccessTokenExpiringSoon(token: string, bufferMs = 60 * 1000) {
    const expiry = getJwtExpiryMs(token);
    if (!expiry) {
        return false;
    }
    return expiry - Date.now() <= bufferMs;
}
