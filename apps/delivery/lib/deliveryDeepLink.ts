import {
    customerDeliveryNotificationLimits,
    isCustomerDeliveryRequestId,
} from '@gredice/notifications/customer-delivery';

export const deliveryDeepLinkRequestIdMaxLength =
    customerDeliveryNotificationLimits.requestIdCharacters;
export const deliveryReturnTargetMaxLength = 2048;
export const deliveryLoginFailureSearchParam = 'loginFailure';
export const deliveryDeepLinkUnavailableMessage =
    'Traženu dostavu nije moguće prikazati. Provjeri poveznicu ili odaberi dostavu s popisa.';

export type DeliveryLoginFailure =
    | 'oauth-provider'
    | 'oauth-missing-token'
    | 'oauth-token-exchange';

export type DeliveryDeepLinkTarget =
    | { kind: 'none' }
    | { kind: 'invalid' }
    | { kind: 'request'; requestId: string };

export type DeliveryDeepLinkAccountResolution = {
    accountId: string;
    shouldSetAccountCookie: boolean;
};

export type DeliveryOAuthProvider = 'facebook' | 'google';

function hasControlCharacter(value: string) {
    for (const character of value) {
        const code = character.charCodeAt(0);
        if (code <= 31 || code === 127) return true;
    }
    return false;
}

export function isDeliveryDeepLinkRequestId(value: string) {
    return isCustomerDeliveryRequestId(value);
}

export function parseDeliveryDeepLink(
    value: string | string[] | null | undefined,
): DeliveryDeepLinkTarget {
    if (value === null || value === undefined) return { kind: 'none' };
    if (typeof value !== 'string' || !isDeliveryDeepLinkRequestId(value)) {
        return { kind: 'invalid' };
    }
    return { kind: 'request', requestId: value };
}

export function buildDeliveryDeepLink(requestId: string) {
    if (!isDeliveryDeepLinkRequestId(requestId)) return null;
    return `/?delivery=${encodeURIComponent(requestId)}`;
}

export function buildDeliveryDashboardRequestPath(
    target: DeliveryDeepLinkTarget,
) {
    if (target.kind !== 'request') return '/api/dashboard';
    const search = new URLSearchParams({ delivery: target.requestId });
    return `/api/dashboard?${search.toString()}`;
}

export function createDeliveryDashboardRequestPathTracker(
    initialRequestPath: string,
) {
    let requestPath = initialRequestPath;

    return {
        current() {
            return requestPath;
        },
        recordSuccess(successfulRequestPath: string) {
            if (requestPath === successfulRequestPath) {
                requestPath = '/api/dashboard';
            }
        },
    };
}

export function resolveDeliveryDeepLinkAccount({
    authorizedAccountIds,
    currentAccountId,
    ownerAccountId,
    target,
}: {
    authorizedAccountIds: readonly string[];
    currentAccountId: string;
    ownerAccountId: string | null;
    target: DeliveryDeepLinkTarget;
}): DeliveryDeepLinkAccountResolution {
    const accountId =
        target.kind === 'request' &&
        ownerAccountId !== null &&
        authorizedAccountIds.includes(ownerAccountId)
            ? ownerAccountId
            : currentAccountId;

    return {
        accountId,
        shouldSetAccountCookie: accountId !== currentAccountId,
    };
}

export function safeDeliveryReturnTarget(
    value: string | null | undefined,
): string {
    if (
        !value ||
        value.length > deliveryReturnTargetMaxLength ||
        !value.startsWith('/') ||
        value.startsWith('//') ||
        value.includes('\\') ||
        value.includes('#') ||
        hasControlCharacter(value)
    ) {
        return '/';
    }

    try {
        const base = new URL('https://delivery.invalid');
        const target = new URL(value, base);
        const decodedPathname = decodeURIComponent(target.pathname);
        const restrictedPathname = decodedPathname.toLowerCase();
        const isApiPath =
            restrictedPathname === '/api' ||
            restrictedPathname.startsWith('/api/');
        const isAuthPath =
            restrictedPathname === '/prijava' ||
            restrictedPathname.startsWith('/prijava/');

        if (
            target.origin !== base.origin ||
            decodedPathname.includes('\\') ||
            hasControlCharacter(decodedPathname) ||
            isApiPath ||
            isAuthPath
        )
            return '/';
        return `${target.pathname}${target.search}`;
    } catch {
        return '/';
    }
}

export function buildDeliveryReturnTarget(pathname: string, search: string) {
    const normalizedSearch = search
        ? search.startsWith('?')
            ? search
            : `?${search}`
        : '';
    return safeDeliveryReturnTarget(`${pathname}${normalizedSearch}`);
}

export function parseDeliveryLoginFailure(
    value: string | string[] | null | undefined,
): DeliveryLoginFailure | null {
    switch (value) {
        case 'oauth-provider':
        case 'oauth-missing-token':
        case 'oauth-token-exchange':
            return value;
        default:
            return null;
    }
}

export function buildDeliveryLoginFailureReturnTarget(
    returnTarget: string,
    failure: DeliveryLoginFailure,
) {
    const safeReturnTarget = safeDeliveryReturnTarget(returnTarget);
    const target = new URL(safeReturnTarget, 'https://delivery.invalid');
    target.searchParams.set(deliveryLoginFailureSearchParam, failure);
    return `${target.pathname}${target.search}`;
}

export function buildDeliveryOAuthCallbackPath(
    provider: DeliveryOAuthProvider,
    returnTarget: string,
) {
    const callbackPath = `/prijava/${provider}-prijava/povratak`;
    const params = new URLSearchParams({
        returnTo: safeDeliveryReturnTarget(returnTarget),
    });
    return `${callbackPath}?${params.toString()}`;
}
