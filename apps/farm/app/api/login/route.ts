import { getServerGrediceApiOrigin } from '@gredice/client';
import {
    getRefreshTokenUserId,
    getUser,
    revokeRefreshToken,
} from '@gredice/storage';
import { clearCookie, setCookie, verifyJwt } from '../../../lib/auth/auth';
import {
    establishFarmLoginSession,
    type FarmLoginErrorCode,
    getFarmLoginErrorStatus,
    getIssuedRefreshToken,
    mapTrustedLoginError,
    parseFarmLoginCredentials,
    parseFarmLoginTokens,
} from '../../../lib/auth/farmLoginContract';
import {
    clearRefreshCookie,
    setRefreshCookie,
} from '../../../lib/auth/refreshCookies';

const API_BASE_URL = getServerGrediceApiOrigin();

function errorResponse(error: FarmLoginErrorCode) {
    return Response.json(
        { error },
        {
            status: getFarmLoginErrorStatus(error),
            headers: { 'Cache-Control': 'no-store' },
        },
    );
}

async function revokeIssuedSession(refreshToken: string) {
    try {
        await revokeRefreshToken(refreshToken);
    } catch {
        // Authentication still fails closed if cleanup is temporarily unavailable.
    }
}

async function clearPartialSession() {
    await Promise.allSettled([clearCookie(), clearRefreshCookie()]);
}

export async function POST(request: Request) {
    const body: unknown = await request.json().catch(() => null);
    const credentials = parseFarmLoginCredentials(body);
    if (!credentials) {
        return errorResponse('invalid_request');
    }

    let response: Response;
    try {
        response = await fetch(`${API_BASE_URL}/api/auth/login`, {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(credentials),
            cache: 'no-store',
        });
    } catch {
        return errorResponse('service_unavailable');
    }

    const data: unknown = await response.json().catch(() => null);
    if (!response.ok) {
        const issuedRefreshToken = getIssuedRefreshToken(data);
        if (issuedRefreshToken) {
            await revokeIssuedSession(issuedRefreshToken);
        }
        return errorResponse(mapTrustedLoginError(data, response.status));
    }

    const tokens = parseFarmLoginTokens(data);
    if (!tokens) {
        const issuedRefreshToken = getIssuedRefreshToken(data);
        if (issuedRefreshToken) {
            await revokeIssuedSession(issuedRefreshToken);
        }
        return errorResponse('service_unavailable');
    }

    const sessionResult = await establishFarmLoginSession(tokens, {
        clearSession: clearPartialSession,
        loadRefreshTokenSubject: async (refreshToken) => {
            const result = await getRefreshTokenUserId(refreshToken);
            return result?.userId ?? null;
        },
        loadUser: getUser,
        persistSession: async ({ token, refreshToken }) => {
            await setRefreshCookie(refreshToken);
            await setCookie(token);
        },
        revokeRefreshToken,
        verifyAccessTokenSubject: async (token) => {
            const { error, result } = await verifyJwt(token);
            const subject = result?.payload.sub;
            return !error && subject && subject.trim() === subject
                ? subject
                : null;
        },
    });
    if ('error' in sessionResult) {
        return errorResponse(sessionResult.error);
    }

    return Response.json(
        { ok: true },
        { headers: { 'Cache-Control': 'no-store' } },
    );
}
