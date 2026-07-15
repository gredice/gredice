const maximumCallbackUrlLength = 2_048;
const oauthProviders = new Set(['facebook', 'google']);

function callbackPath(provider) {
    return `/prijava/${provider}-prijava/povratak`;
}

function createDesktopOAuthCallbackRedirectUrl({
    protocol,
    provider,
    sourceAuthUrl,
    trustedNavigationOrigins,
}) {
    if (
        typeof protocol !== 'string' ||
        !/^gredice-[a-z0-9-]+$/.test(protocol) ||
        !oauthProviders.has(provider)
    ) {
        return null;
    }

    const callbackUrl = new URL(`${protocol}://auth-callback/${provider}`);

    try {
        const authUrl = new URL(sourceAuthUrl);
        const redirectValues = authUrl.searchParams.getAll('redirect');
        if (redirectValues.length !== 1) {
            return callbackUrl.toString();
        }

        const [redirectValue] = redirectValues;
        if (!redirectValue || redirectValue.length > maximumCallbackUrlLength) {
            return callbackUrl.toString();
        }

        const nestedCallbackUrl = new URL(redirectValue);
        const trustedOrigins = new Set(trustedNavigationOrigins);
        const returnToValues =
            nestedCallbackUrl.searchParams.getAll('returnTo');
        if (
            nestedCallbackUrl.username ||
            nestedCallbackUrl.password ||
            nestedCallbackUrl.hash ||
            !trustedOrigins.has(nestedCallbackUrl.origin) ||
            nestedCallbackUrl.pathname !== callbackPath(provider) ||
            returnToValues.length > 1 ||
            Array.from(nestedCallbackUrl.searchParams.keys()).some(
                (key) => key !== 'returnTo',
            )
        ) {
            return callbackUrl.toString();
        }

        const [returnTo] = returnToValues;
        if (returnTo) {
            callbackUrl.searchParams.set('returnTo', returnTo);
            if (callbackUrl.toString().length > maximumCallbackUrlLength) {
                callbackUrl.searchParams.delete('returnTo');
            }
        }
    } catch (_error) {
        return callbackUrl.toString();
    }

    return callbackUrl.toString();
}

module.exports = { createDesktopOAuthCallbackRedirectUrl };
