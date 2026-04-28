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

function resolveAccountId(
    accountIds: string[],
    selectedAccountId: string | undefined,
): string | undefined {
    if (selectedAccountId && accountIds.includes(selectedAccountId)) {
        return selectedAccountId;
    }
    return accountIds[0];
}

async function authFromToken(token: string, roles: string[]) {
    const { result, error } = await verifyJwt(token);
    const payload = result?.payload as TokenClaims | undefined;
    const userId = payload?.sub;
    if (error || typeof userId !== 'string' || userId.length === 0) {
        throw new Error('Unauthorized: Invalid user ID');
    }

    const claims = payload?.gredice;
    const claimsAccountIds = claims?.accountIds;
    const canUseClaims =
        typeof claims?.userName === 'string' &&
        typeof claims?.role === 'string' &&
        Array.isArray(claimsAccountIds) &&
        claimsAccountIds.every((accountId) => typeof accountId === 'string');

    const authUser: AuthUser = canUseClaims
        ? {
              id: userId,
              userName: claims.userName,
              accountIds: claimsAccountIds,
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
    const [roles] = args;
    const accessToken = await refreshSessionIfNeeded();
    if (accessToken) {
        return await authFromToken(accessToken, roles);
    }

    return await baseAuth(...args);
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
