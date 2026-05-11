import { doUseRefreshToken, getUser } from '@gredice/storage';
import type { Context } from 'hono';
import { getCookie } from 'hono/cookie';
import { createJwt, setCookie, verifyJwt } from '../auth/auth';
import { clearRefreshCookie, setRefreshCookie } from '../auth/refreshCookies';
import {
    accessTokenExpiry,
    accountCookieName,
    refreshTokenCookieName,
    sessionCookieName,
} from '../auth/sessionConfig';

type AuthContext = Exclude<
    Awaited<ReturnType<typeof getAuthContextFromAccessToken>>,
    null
>;

export type AuthVariables = {
    authContext: AuthContext;
};

function resolveAccountId(
    accountIds: string[],
    selectedAccountId: string | undefined,
): string | undefined {
    if (selectedAccountId && accountIds.includes(selectedAccountId)) {
        return selectedAccountId;
    }
    return accountIds[0];
}

function getAccessToken(context: Context): string | undefined {
    const sessionToken = getCookie(context, sessionCookieName);
    if (sessionToken) {
        return sessionToken;
    }

    const authorizationHeader = context.req.header('Authorization');
    if (authorizationHeader?.toLowerCase().startsWith('bearer ')) {
        return authorizationHeader.substring(7);
    }

    return undefined;
}

function isExpectedExpiryError(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error);
    return message.includes('claim timestamp check failed');
}

async function getAuthContextFromAccessToken(
    context: Context,
    roles: string[],
) {
    const accessToken = getAccessToken(context);
    if (!accessToken) {
        return null;
    }

    try {
        const { result, error } = await verifyJwt(accessToken);
        if (error) {
            if (!isExpectedExpiryError(error)) {
                console.warn('Unauthorized: invalid access token', error);
            }
            return null;
        }

        const userId = result?.payload.sub;
        if (typeof userId !== 'string' || userId.length === 0) {
            return null;
        }

        const dbUser = await getUser(userId);
        if (!dbUser || !roles.includes(dbUser.role)) {
            return null;
        }

        const accountIds = dbUser.accounts.map((account) => account.accountId);
        const selectedAccountId = getCookie(context, accountCookieName);
        const accountId = resolveAccountId(accountIds, selectedAccountId);
        if (!accountId) {
            return null;
        }

        return {
            userId: dbUser.id,
            user: {
                id: dbUser.id,
                accountIds,
                role: dbUser.role,
            },
            accountId,
        };
    } catch (error) {
        if (!isExpectedExpiryError(error)) {
            console.warn('Unauthorized: invalid access token', error);
        }
        return null;
    }
}

export function authValidator(roles: string[]) {
    return async (context: Context, next: () => Promise<void>) => {
        const authContext = await getAuthContextFromAccessToken(context, roles);
        if (authContext) {
            context.set('authContext', authContext);
            return await next();
        }

        const refreshToken = getCookie(context, refreshTokenCookieName);
        if (!refreshToken) {
            return context.newResponse('Unauthorized', { status: 401 });
        }

        const refreshed = await doUseRefreshToken(refreshToken);
        if (!refreshed) {
            clearRefreshCookie(context);
            console.warn('Unauthorized: invalid refresh token');
            return context.newResponse('Unauthorized', { status: 401 });
        }

        const dbUser = await getUser(refreshed.userId);
        if (!dbUser) {
            clearRefreshCookie(context);
            console.warn('Unauthorized: user not found for refresh token');
            return context.newResponse('Unauthorized', { status: 401 });
        }

        if (!roles.includes(dbUser.role)) {
            console.warn('Unauthorized: role not allowed', dbUser.role);
            return context.newResponse('Unauthorized', { status: 401 });
        }

        const accountIds = dbUser.accounts.map((account) => account.accountId);
        const selectedAccountId = getCookie(context, accountCookieName);
        const accountId = resolveAccountId(accountIds, selectedAccountId);
        if (!accountId) {
            console.warn('Unauthorized: missing account for user');
            return context.newResponse('Unauthorized', { status: 401 });
        }

        const newAccessToken = await createJwt(
            refreshed.userId,
            accessTokenExpiry,
        );
        await Promise.all([
            setCookie(context, newAccessToken),
            setRefreshCookie(context, refreshToken),
        ]);

        context.set('authContext', {
            userId: dbUser.id,
            user: {
                id: dbUser.id,
                accountIds,
                role: dbUser.role,
            },
            accountId,
        });

        return await next();
    };
}
