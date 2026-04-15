import { doUseRefreshToken, getUser } from '@gredice/storage';
import type { Context } from 'hono';
import { getCookie } from 'hono/cookie';
import { auth, createJwt, setCookie } from '../auth/auth';
import { clearRefreshCookie, setRefreshCookie } from '../auth/refreshCookies';
import {
    accessTokenExpiry,
    accountCookieName,
    refreshTokenCookieName,
} from '../auth/sessionConfig';

export type AuthVariables = {
    authContext: Awaited<ReturnType<typeof auth>>;
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

export function authValidator(roles: string[]) {
    return async (context: Context, next: () => Promise<void>) => {
        try {
            const authContext = await auth(roles);
            // Override accountId from the account-selection cookie
            const selectedAccountId = getCookie(context, accountCookieName);
            if (
                selectedAccountId &&
                authContext.user.accountIds.includes(selectedAccountId)
            ) {
                authContext.accountId = selectedAccountId;
            }
            context.set('authContext', authContext);
            return await next();
        } catch {
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

            const accountIds = dbUser.accounts.map(
                (account) => account.accountId,
            );
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
        }
    };
}
