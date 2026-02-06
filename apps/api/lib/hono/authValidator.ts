import { doUseRefreshToken, getUser } from '@gredice/storage';
import type { Context } from 'hono';
import { getCookie } from 'hono/cookie';
import { auth, createJwt, setCookie } from '../auth/auth';
import { clearRefreshCookie, setRefreshCookie } from '../auth/refreshCookies';
import {
    accessTokenExpiry,
    refreshTokenCookieName,
} from '../auth/sessionConfig';

export type AuthVariables = {
    authContext: Awaited<ReturnType<typeof auth>>;
};

export function authValidator(roles: string[]) {
    return async (context: Context, next: () => Promise<void>) => {
        try {
            const authContext = await auth(roles);
            context.set('authContext', authContext);
            return await next();
        } catch (error) {
            const refreshToken = getCookie(context, refreshTokenCookieName);
            if (!refreshToken) {
                console.warn('Unauthorized:', error);
                return context.newResponse('Unauthorized', { status: 401 });
            }

            const refreshed = await doUseRefreshToken(refreshToken);
            if (!refreshed) {
                await clearRefreshCookie(context);
                console.warn('Unauthorized: invalid refresh token');
                return context.newResponse('Unauthorized', { status: 401 });
            }

            const dbUser = await getUser(refreshed.userId);
            if (!dbUser) {
                await clearRefreshCookie(context);
                console.warn('Unauthorized: user not found for refresh token');
                return context.newResponse('Unauthorized', { status: 401 });
            }

            if (!roles.includes(dbUser.role)) {
                console.warn('Unauthorized: role not allowed', dbUser.role);
                return context.newResponse('Unauthorized', { status: 401 });
            }

            const accountId = dbUser.accounts[0]?.accountId;
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
                    accountIds: dbUser.accounts.map(
                        (account) => account.accountId,
                    ),
                    role: dbUser.role,
                },
                accountId,
            });

            return await next();
        }
    };
}
