import 'server-only';
import { getUser as storageGetUser } from '@gredice/storage';
import {
    baseAuth,
    baseWithAuth,
    clearCookie,
    createJwt,
    setCookie,
    verifyJwt,
} from './baseAuth';
import { refreshSessionIfNeeded } from './sessionRefresh';

export { clearCookie, createJwt, setCookie, verifyJwt };

type AuthUser = {
    id: string;
    userName: string;
    accountIds: string[];
    role: string;
};

async function authFromToken(token: string, roles: string[]) {
    const { result, error } = await verifyJwt(token);
    const userId = result?.payload?.sub;
    if (error || typeof userId !== 'string' || userId.length === 0) {
        throw new Error('Unauthorized: Invalid user ID');
    }

    const user = await storageGetUser(userId);
    if (!user) {
        throw new Error('User not found');
    }

    if (!roles.includes(user.role)) {
        throw new Error('Unauthorized');
    }

    const accountIds = user.accounts.map(
        (accountUsers) => accountUsers.accountId,
    );
    const accountId = accountIds[0];
    if (!accountId) {
        throw new Error('Account not found');
    }

    const authUser: AuthUser = {
        id: user.id,
        userName: user.userName,
        accountIds,
        role: user.role,
    };

    return {
        userId: user.id,
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
