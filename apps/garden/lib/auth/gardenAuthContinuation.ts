const MAXIMUM_GARDEN_AUTH_RETURN_LENGTH = 2_048;
const MAXIMUM_OAUTH_FRAGMENT_VALUE_LENGTH = 8_192;
const GARDEN_AUTH_RETURN_BASE = 'https://garden.gredice.invalid';
const supportedOutletReturnQueryKeys = new Set(['ponuda', 'rezervacija']);
const supportedCallbackQueryKeys = new Set(['error', 'returnTo']);
const supportedFragmentKeys = new Set(['refreshToken', 'token']);

export type GardenOAuthProvider = 'facebook' | 'google';
export type GardenAuthReturnPath = '/' | '/outlet' | `/outlet?${string}`;

function containsControlCharacter(value: string) {
    return Array.from(value).some((character) => {
        const code = character.charCodeAt(0);
        return code <= 31 || code === 127;
    });
}

function hasOnlySupportedKeys(
    searchParams: URLSearchParams,
    supportedKeys: ReadonlySet<string>,
) {
    for (const key of searchParams.keys()) {
        if (!supportedKeys.has(key)) {
            return false;
        }
    }

    return true;
}

function canonicalOutletReturnPath(
    searchParams: URLSearchParams,
): GardenAuthReturnPath {
    if (
        !hasOnlySupportedKeys(searchParams, supportedOutletReturnQueryKeys) ||
        searchParams.getAll('ponuda').length > 1 ||
        searchParams.getAll('rezervacija').length > 1
    ) {
        return '/';
    }

    const offerId = searchParams.get('ponuda');
    const reservationIntent = searchParams.get('rezervacija');
    if (
        (offerId !== null &&
            (!/^[1-9]\d*$/u.test(offerId) ||
                !Number.isSafeInteger(Number(offerId)))) ||
        (reservationIntent !== null &&
            (reservationIntent !== '1' || offerId === null))
    ) {
        return '/';
    }

    const canonicalSearchParams = new URLSearchParams();
    if (offerId !== null) {
        canonicalSearchParams.set('ponuda', offerId);
    }
    if (reservationIntent !== null) {
        canonicalSearchParams.set('rezervacija', reservationIntent);
    }

    const canonicalQuery = canonicalSearchParams.toString();
    return canonicalQuery ? `/outlet?${canonicalQuery}` : '/outlet';
}

export function getSafeGardenAuthReturnPath(
    candidate: string | null | undefined,
): GardenAuthReturnPath {
    if (
        !candidate ||
        candidate !== candidate.trim() ||
        candidate.length > MAXIMUM_GARDEN_AUTH_RETURN_LENGTH ||
        containsControlCharacter(candidate) ||
        !candidate.startsWith('/') ||
        candidate.startsWith('//') ||
        candidate.includes('#')
    ) {
        return '/';
    }

    const queryIndex = candidate.indexOf('?');
    const rawPathname =
        queryIndex === -1 ? candidate : candidate.slice(0, queryIndex);
    if (
        rawPathname.includes('\\') ||
        rawPathname.includes('%') ||
        rawPathname
            .split('/')
            .some((segment) => segment === '.' || segment === '..')
    ) {
        return '/';
    }

    let parsedUrl: URL;
    try {
        parsedUrl = new URL(candidate, GARDEN_AUTH_RETURN_BASE);
    } catch {
        return '/';
    }

    if (
        parsedUrl.origin !== GARDEN_AUTH_RETURN_BASE ||
        parsedUrl.username ||
        parsedUrl.password ||
        parsedUrl.hash
    ) {
        return '/';
    }

    if (parsedUrl.pathname === '/') {
        return '/';
    }
    if (parsedUrl.pathname !== '/outlet') {
        return '/';
    }

    return canonicalOutletReturnPath(parsedUrl.searchParams);
}

export function getGardenAuthFailureReturnPath(
    candidate: string | null | undefined,
): GardenAuthReturnPath {
    const safeReturnPath = getSafeGardenAuthReturnPath(candidate);
    if (!safeReturnPath.startsWith('/outlet?')) {
        return safeReturnPath;
    }

    const parsedUrl = new URL(safeReturnPath, GARDEN_AUTH_RETURN_BASE);
    parsedUrl.searchParams.delete('rezervacija');
    const query = parsedUrl.searchParams.toString();
    return query ? `/outlet?${query}` : '/outlet';
}

export function getGardenOAuthStartUrl({
    apiOrigin,
    gardenOrigin,
    provider,
    returnTo,
}: {
    apiOrigin: string;
    gardenOrigin: string;
    provider: GardenOAuthProvider;
    returnTo: string | null | undefined;
}) {
    const callbackUrl = new URL(
        `/prijava/${provider}-prijava/povratak`,
        gardenOrigin,
    );
    callbackUrl.searchParams.set(
        'returnTo',
        getSafeGardenAuthReturnPath(returnTo),
    );

    const authUrl = new URL(`/api/auth/${provider}`, apiOrigin);
    authUrl.searchParams.set('redirect', callbackUrl.toString());
    return authUrl.toString();
}

export function resolveGardenOAuthCallbackQuery(search: string) {
    const searchParams = new URLSearchParams(search);
    const returnToValues = searchParams.getAll('returnTo');
    const errorValues = searchParams.getAll('error');
    const isSupported =
        hasOnlySupportedKeys(searchParams, supportedCallbackQueryKeys) &&
        returnToValues.length <= 1 &&
        errorValues.length <= 1;
    const returnTo = getSafeGardenAuthReturnPath(
        isSupported ? returnToValues[0] : null,
    );

    return {
        failureReturnTo: getGardenAuthFailureReturnPath(returnTo),
        hasServerError: !isSupported || errorValues.length === 1,
        returnTo,
    };
}

export function resolveGardenOAuthFragment(hash: string) {
    const searchParams = new URLSearchParams(
        hash.startsWith('#') ? hash.slice(1) : hash,
    );
    const tokenValues = searchParams.getAll('token');
    const refreshTokenValues = searchParams.getAll('refreshToken');
    if (
        !hasOnlySupportedKeys(searchParams, supportedFragmentKeys) ||
        tokenValues.length !== 1 ||
        refreshTokenValues.length > 1
    ) {
        return null;
    }

    const [token] = tokenValues;
    const [refreshToken] = refreshTokenValues;
    if (
        !token ||
        token.length > MAXIMUM_OAUTH_FRAGMENT_VALUE_LENGTH ||
        (refreshToken !== undefined &&
            (!refreshToken ||
                refreshToken.length > MAXIMUM_OAUTH_FRAGMENT_VALUE_LENGTH))
    ) {
        return null;
    }

    return {
        refreshToken: refreshToken ?? null,
        token,
    };
}
