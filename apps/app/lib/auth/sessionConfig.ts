export const accessTokenExpiry = '15m';
export const accessTokenExpiryMs = 15 * 60 * 1000; // 15 minutes in milliseconds
export const refreshTokenCookieName = 'gredice_refresh';
export const sessionCookieName = 'gredice_session';
export const refreshTokenExpiryMs = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds

/** Cookie that stores the admin's original refresh token during impersonation (httpOnly). */
export const impersonationRefreshCookieName = 'gredice_impersonation_refresh';
/** Non-httpOnly cookie flag so client-side code can detect active impersonation. */
export const impersonationFlagCookieName = 'gredice_impersonating';

/**
 * Cookie domain for cross-subdomain SSO.
 * Set COOKIE_DOMAIN env var to the root domain (e.g. "gredice.com" or "gredice.test")
 * so all apps on subdomains share the same session cookies.
 * When unset, cookies are scoped to the current host (no SSO).
 */
export const cookieDomain = process.env.COOKIE_DOMAIN || undefined;
