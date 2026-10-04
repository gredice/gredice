export const deliveryNativeClientId = 'gredice-delivery-android';
export const deliveryNativeRedirectUri =
    'https://dostava.gredice.com/android/auth/callback';

export type DeliveryNativeAuthorizationRequest = {
    clientId: typeof deliveryNativeClientId;
    redirectUri: typeof deliveryNativeRedirectUri;
    codeChallenge: string;
    codeChallengeMethod: 'S256';
    state: string;
};

function singleValue(value: string | string[] | undefined) {
    return typeof value === 'string' ? value : null;
}

export function parseDeliveryNativeAuthorizationRequest(
    searchParams: Record<string, string | string[] | undefined>,
): DeliveryNativeAuthorizationRequest | null {
    const clientId = singleValue(searchParams.client_id);
    const redirectUri = singleValue(searchParams.redirect_uri);
    const codeChallenge = singleValue(searchParams.code_challenge);
    const codeChallengeMethod = singleValue(searchParams.code_challenge_method);
    const state = singleValue(searchParams.state);
    if (
        clientId !== deliveryNativeClientId ||
        redirectUri !== deliveryNativeRedirectUri ||
        codeChallengeMethod !== 'S256' ||
        !codeChallenge ||
        !/^[A-Za-z0-9_-]{43}$/.test(codeChallenge) ||
        !state ||
        !/^[A-Za-z0-9_-]{32,128}$/.test(state)
    ) {
        return null;
    }

    return {
        clientId,
        redirectUri,
        codeChallenge,
        codeChallengeMethod,
        state,
    };
}

export function deliveryNativeAuthorizationReturnTarget(
    request: DeliveryNativeAuthorizationRequest,
) {
    const params = new URLSearchParams({
        client_id: request.clientId,
        redirect_uri: request.redirectUri,
        code_challenge: request.codeChallenge,
        code_challenge_method: request.codeChallengeMethod,
        state: request.state,
    });
    return `/prijava/android?${params.toString()}`;
}

export function isDeliveryNativeAuthorizationReturnTarget(target: URL) {
    const entries = [...target.searchParams.entries()];
    if (entries.length !== 5) return false;
    const values: Record<string, string> = {};
    for (const [key, value] of entries) {
        if (key in values) return false;
        values[key] = value;
    }
    return parseDeliveryNativeAuthorizationRequest(values) !== null;
}

export function deliveryNativeCallbackUrl(input: {
    code: string;
    state: string;
}): `https:${string}` {
    const params = new URLSearchParams({
        code: input.code,
        state: input.state,
    });
    return `${deliveryNativeRedirectUri}?${params.toString()}`;
}
