import 'server-only';
import { getUser as storageGetUser } from '@gredice/storage';
import { cookies } from 'next/headers';
import {
    baseAuth,
    baseWithAuth,
    clearCookie,
    createJwt,
    setCookie,
    verifyJwt,
} from './baseAuth';
import { accountCookieName } from './sessionConfig';
import { refreshSessionIfNeeded } from './sessionRefresh';

export { clearCookie, createJwt, setCookie, verifyJwt };

type AuthUser = {
    id: string;
    userName: string;
    accountIds: string[];
    role: string;
};

type TokenClaims = {
    sub?: unknown;
    gredice?: {
        userName?: unknown;
        accountIds?: unknown;
        role?: unknown;
    };
};

type GrediceClaims = {
    userName: string;
    accountIds: string[];
    role: string;
};

function hasGrediceClaims(
    claims: TokenClaims['gredice'],
): claims is GrediceClaims {
    return (
        typeof claims?.userName === 'string' &&
        typeof claims.role === 'string' &&
        Array.isArray(claims.accountIds) &&
        claims.accountIds.every((accountId) => typeof accountId === 'string')
    );
}

function resolveAccountId(
    accountIds: string[],
    selectedAccountId: string | undefined,
): string | undefined {
    if (selectedAccountId && accountIds.includes(selectedAccountId)) {
        return selectedAccountId;
    }
    return accountIds[0];
}

function isAuthError(error: unknown, message: string) {
    return error instanceof Error && error.message === message;
}

function isUnauthenticatedError(error: unknown) {
    return (
        error instanceof Error &&
        (error.name === 'UnauthorizedError' ||
            error.message.startsWith('Unauthorized:') ||
            error.message === 'User not found')
    );
}

async function interruptExpectedAuthError(error: unknown): Promise<never> {
    if (isAuthError(error, 'Unauthorized')) {
        const { forbidden } = await import('next/navigation');
        forbidden();
    }

    if (isAuthError(error, 'Account not found')) {
        const { forbidden } = await import('next/navigation');
        forbidden();
    }

    if (isUnauthenticatedError(error)) {
        const { unauthorized } = await import('next/navigation');
        unauthorized();
    }

    throw error;
}

async function authFromToken(token: string, roles: string[]) {
    const { result, error } = await verifyJwt(token);
    const payload = result?.payload as TokenClaims | undefined;
    const userId = payload?.sub;
    if (error || typeof userId !== 'string' || userId.length === 0) {
        throw new Error('Unauthorized: Invalid user ID');
    }

    const claims = payload?.gredice;
    const authUser: AuthUser = hasGrediceClaims(claims)
        ? {
              id: userId,
              userName: claims.userName,
              accountIds: claims.accountIds,
              role: claims.role,
          }
        : await storageGetUser(userId).then((user) => {
              if (!user) {
                  throw new Error('User not found');
              }

              return {
                  id: user.id,
                  userName: user.userName,
                  accountIds: user.accounts.map(
                      (accountUsers) => accountUsers.accountId,
                  ),
                  role: user.role,
              };
          });

    if (!roles.includes(authUser.role)) {
        throw new Error('Unauthorized');
    }
    const selectedAccountId = (await cookies()).get(accountCookieName)?.value;
    const accountId = resolveAccountId(authUser.accountIds, selectedAccountId);
    if (!accountId) {
        throw new Error('Account not found');
    }

    return {
        userId,
        user: authUser,
        accountId,
    };
}

export async function auth(...args: Parameters<typeof baseAuth>) {
    try {
        const [roles] = args;
        const accessToken = await refreshSessionIfNeeded({
            // auth() is used during Server Component rendering, where cookies are read-only.
            persistCookies: false,
        });
        if (accessToken) {
            return await authFromToken(accessToken, roles);
        }

        return await baseAuth(...args);
    } catch (error) {
        return await interruptExpectedAuthError(error);
    }
}

export async function withAuth(...args: Parameters<typeof baseWithAuth>) {
    const [roles, handler] = args;
    const accessToken = await refreshSessionIfNeeded();
    if (accessToken) {
        try {
            const authContext = await authFromToken(accessToken, roles);
            return await handler(authContext);
        } catch {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }
    }

    return await baseWithAuth(...args);
}
