const MAX_FARM_RETURN_PATH_LENGTH = 2048;

const FARM_RETURN_EXACT_PATHS = new Set([
    '/',
    '/greenhouse',
    '/more',
    '/notifications',
    '/operations',
    '/payouts',
    '/plants',
    '/raised-beds',
    '/schedule',
    '/settings',
]);

const FARM_RETURN_DETAIL_PATH =
    /^\/(?:operations|plants|raised-beds)\/[1-9]\d*$/;
const ENCODED_PATH_SEPARATOR = /%(?:2f|5c)/i;

function containsControlCharacter(value: string) {
    return Array.from(value).some((character) => {
        const code = character.charCodeAt(0);
        return code <= 31 || code === 127;
    });
}

function isSupportedFarmPath(pathname: string) {
    return (
        FARM_RETURN_EXACT_PATHS.has(pathname) ||
        FARM_RETURN_DETAIL_PATH.test(pathname)
    );
}

export function getSafeFarmReturnPath(
    candidate: string | null | undefined,
): string {
    if (
        !candidate ||
        candidate !== candidate.trim() ||
        candidate.length > MAX_FARM_RETURN_PATH_LENGTH ||
        containsControlCharacter(candidate) ||
        !candidate.startsWith('/') ||
        candidate.startsWith('//')
    ) {
        return '/';
    }

    const suffixIndex = candidate.search(/[?#]/);
    const rawPathname =
        suffixIndex === -1 ? candidate : candidate.slice(0, suffixIndex);
    if (
        rawPathname.includes('\\') ||
        ENCODED_PATH_SEPARATOR.test(rawPathname)
    ) {
        return '/';
    }

    let decodedPathname: string;
    let parsedUrl: URL;
    try {
        decodedPathname = decodeURIComponent(rawPathname);
        parsedUrl = new URL(candidate, 'https://farm.gredice.invalid');
    } catch {
        return '/';
    }

    if (
        decodedPathname.includes('\\') ||
        decodedPathname.includes('//') ||
        containsControlCharacter(decodedPathname) ||
        decodedPathname
            .split('/')
            .some((segment) => segment === '.' || segment === '..') ||
        parsedUrl.origin !== 'https://farm.gredice.invalid' ||
        !isSupportedFarmPath(decodedPathname)
    ) {
        return '/';
    }

    return candidate;
}

export type FarmOAuthProvider = 'facebook' | 'google';

export function getFarmOAuthStartUrl({
    apiOrigin,
    farmOrigin,
    provider,
    returnTo,
}: {
    apiOrigin: string;
    farmOrigin: string;
    provider: FarmOAuthProvider;
    returnTo: string | null | undefined;
}) {
    const safeReturnTo = getSafeFarmReturnPath(returnTo);
    const callbackPath =
        provider === 'google'
            ? '/prijava/google-prijava/povratak'
            : '/prijava/facebook-prijava/povratak';
    const callbackUrl = new URL(callbackPath, farmOrigin);
    callbackUrl.searchParams.set('returnTo', safeReturnTo);

    const authUrl = new URL(`/api/auth/${provider}`, apiOrigin);
    authUrl.searchParams.set('redirect', callbackUrl.toString());
    return authUrl.toString();
}
