export type OAuthCallbackProvider = 'facebook' | 'google';

export type OAuthCallbackErrorCode =
    | 'canceled'
    | 'state_invalid'
    | 'provider_error'
    | 'callback_error';

export type OAuthCallbackCookieName =
    | 'oauth_state'
    | 'oauth_redirect'
    | 'oauth_timezone';

export const oauthStateCookieName: OAuthCallbackCookieName = 'oauth_state';
export const oauthRedirectCookieName: OAuthCallbackCookieName =
    'oauth_redirect';
export const oauthTimeZoneCookieName: OAuthCallbackCookieName =
    'oauth_timezone';
export const oauthCallbackCookieNames: ReadonlyArray<OAuthCallbackCookieName> =
    Object.freeze([
        oauthStateCookieName,
        oauthRedirectCookieName,
        oauthTimeZoneCookieName,
    ]);

const defaultWebAppOrigin = 'https://vrt.gredice.com';
const maximumCallbackUrlLength = 2_048;
const maximumAuthorizationValueLength = 4_096;

const allowedProductionCallbackOrigins = new Set([
    'https://app.gredice.com',
    'https://dostava.gredice.com',
    'https://farma.gredice.com',
    'https://gredice.com',
    'https://vrt.gredice.com',
    'https://www.gredice.com',
]);

const allowedLocalCallbackHosts = new Set([
    '127.0.0.1',
    '[::1]',
    'app.gredice.test',
    'dostava.gredice.test',
    'farma.gredice.test',
    'localhost',
    'vrt.gredice.test',
    'www.gredice.test',
]);

const allowedDesktopRedirectProtocols = new Set([
    'gredice-admin:',
    'gredice-farm:',
    'gredice-garden:',
]);

export type OAuthCallbackDecision =
    | {
          kind: 'continue';
          callbackUrl: string;
          code: string;
          state: string;
          clearCookieNames: ReadonlyArray<OAuthCallbackCookieName>;
      }
    | {
          kind: 'redirect';
          error: OAuthCallbackErrorCode;
          redirectUrl: string;
          clearCookieNames: ReadonlyArray<OAuthCallbackCookieName>;
      };

type ResolveOAuthCallbackInput = {
    provider: OAuthCallbackProvider;
    code?: string;
    state?: string;
    storedState?: string;
    storedRedirect?: string;
    providerError?: string;
    providerErrorReason?: string;
};

function callbackPath(provider: OAuthCallbackProvider) {
    return `/prijava/${provider}-prijava/povratak`;
}

function isAllowedWebCallbackOrigin(url: URL) {
    if (url.username || url.password) {
        return false;
    }

    if (allowedProductionCallbackOrigins.has(url.origin)) {
        return true;
    }

    const hostname = url.hostname.toLowerCase();
    if (
        allowedLocalCallbackHosts.has(hostname) &&
        (url.protocol === 'http:' || url.protocol === 'https:')
    ) {
        return true;
    }

    return false;
}

function hasOnlySupportedCallbackQuery(url: URL) {
    if (url.searchParams.getAll('returnTo').length > 1) {
        return false;
    }

    for (const key of url.searchParams.keys()) {
        if (key !== 'returnTo') {
            return false;
        }
    }
    return true;
}

/**
 * Restricts the browser hand-off to a known Gredice callback surface. The
 * internal route carried in `returnTo` is deliberately left encoded for the
 * receiving app to validate against its own route allowlist.
 */
export function sanitizeOAuthCallbackUrl(
    provider: OAuthCallbackProvider,
    redirectUrl?: string,
) {
    if (!redirectUrl || redirectUrl.length > maximumCallbackUrlLength) {
        return undefined;
    }

    try {
        const parsed = new URL(redirectUrl);
        if (parsed.hash || !hasOnlySupportedCallbackQuery(parsed)) {
            return undefined;
        }

        if (allowedDesktopRedirectProtocols.has(parsed.protocol)) {
            if (
                parsed.hostname === 'auth-callback' &&
                parsed.pathname === `/${provider}` &&
                !parsed.username &&
                !parsed.password &&
                !parsed.port
            ) {
                return parsed.toString();
            }
            return undefined;
        }

        if (
            isAllowedWebCallbackOrigin(parsed) &&
            parsed.pathname === callbackPath(provider)
        ) {
            return parsed.toString();
        }
    } catch {
        return undefined;
    }

    return undefined;
}

export function resolveOAuthCallbackUrl(
    provider: OAuthCallbackProvider,
    storedRedirect?: string,
) {
    const sanitized = sanitizeOAuthCallbackUrl(provider, storedRedirect);
    if (sanitized) {
        return sanitized;
    }

    return new URL(callbackPath(provider), defaultWebAppOrigin).toString();
}

function errorRedirect(callbackUrl: string, error: OAuthCallbackErrorCode) {
    const redirectUrl = new URL(callbackUrl);
    redirectUrl.searchParams.set('error', error);
    return redirectUrl.toString();
}

export function createOAuthCallbackErrorRedirect(
    provider: OAuthCallbackProvider,
    callbackUrl: string,
    error: OAuthCallbackErrorCode,
) {
    const sanitized = resolveOAuthCallbackUrl(provider, callbackUrl);
    return errorRedirect(sanitized, error);
}

function redirectDecision(
    callbackUrl: string,
    error: OAuthCallbackErrorCode,
): OAuthCallbackDecision {
    return {
        kind: 'redirect',
        error,
        redirectUrl: errorRedirect(callbackUrl, error),
        clearCookieNames: oauthCallbackCookieNames,
    };
}

export function resolveOAuthCallback(
    input: ResolveOAuthCallbackInput,
): OAuthCallbackDecision {
    const callbackUrl = resolveOAuthCallbackUrl(
        input.provider,
        input.storedRedirect,
    );

    if (
        !input.state ||
        !input.storedState ||
        input.state.length > maximumAuthorizationValueLength ||
        input.storedState.length > maximumAuthorizationValueLength ||
        input.state !== input.storedState
    ) {
        return redirectDecision(callbackUrl, 'state_invalid');
    }

    if (input.providerError || input.providerErrorReason) {
        const canceled =
            input.providerError === 'access_denied' ||
            input.providerErrorReason === 'user_denied';
        return redirectDecision(
            callbackUrl,
            canceled ? 'canceled' : 'provider_error',
        );
    }

    if (!input.code || input.code.length > maximumAuthorizationValueLength) {
        return redirectDecision(callbackUrl, 'callback_error');
    }

    return {
        kind: 'continue',
        callbackUrl,
        code: input.code,
        state: input.state,
        clearCookieNames: oauthCallbackCookieNames,
    };
}
