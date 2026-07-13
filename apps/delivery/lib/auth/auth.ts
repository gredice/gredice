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

type GrediceClaims = {
    userName: string;
    accountIds: string[];
    role: string;
};

function hasGrediceClaims(value: unknown): value is GrediceClaims {
    if (typeof value !== 'object' || value === null) return false;
    if (!('userName' in value) || typeof value.userName !== 'string') {
        return false;
    }
    if (!('role' in value) || typeof value.role !== 'string') return false;
    return (
        'accountIds' in value &&
        Array.isArray(value.accountIds) &&
        value.accountIds.every((accountId) => typeof accountId === 'string')
    );
}

function resolveAccountId(
    accountIds: string[],
    selectedAccountId: string | undefined,
) {
    return selectedAccountId && accountIds.includes(selectedAccountId)
        ? selectedAccountId
        : accountIds[0];
}

async function authFromToken(token: string, roles: string[]) {
    const { result, error } = await verifyJwt(token);
    const userId = result?.payload.sub;
    if (error || typeof userId !== 'string' || userId.length === 0) {
        throw new Error('Unauthorized: Invalid user ID');
    }

    const claims = result?.payload.gredice;
    const user = hasGrediceClaims(claims)
        ? { id: userId, ...claims }
        : await storageGetUser(userId).then((storedUser) => {
              if (!storedUser) throw new Error('User not found');
              return {
                  id: storedUser.id,
                  userName: storedUser.userName,
                  accountIds: storedUser.accounts.map(
                      (accountUser) => accountUser.accountId,
                  ),
                  role: storedUser.role,
              };
          });
    if (!roles.includes(user.role)) throw new Error('Unauthorized');

    const accountId = resolveAccountId(
        user.accountIds,
        (await cookies()).get(accountCookieName)?.value,
    );
    if (!accountId) throw new Error('Account not found');
    return { userId, user, accountId };
}

export async function auth(...args: Parameters<typeof baseAuth>) {
    const [roles] = args;
    const accessToken = await refreshSessionIfNeeded({
        persistCookies: false,
    });
    return accessToken
        ? await authFromToken(accessToken, roles)
        : baseAuth(...args);
}

export async function withAuth(...args: Parameters<typeof baseWithAuth>) {
    const [roles, handler] = args;
    const accessToken = await refreshSessionIfNeeded();
    if (!accessToken) return baseWithAuth(...args);
    try {
        return await handler(await authFromToken(accessToken, roles));
    } catch {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
}
