import 'server-only';
import { getUser as storageGetUser } from '@gredice/storage';
import { initAuth, initRbac } from '@signalco/auth-server';
import { accessTokenExpiryMs } from './sessionConfig';

function jwtSecretFactory() {
    const signSecret = process.env.GREDICE_JWT_SIGN_SECRET;
    if (!signSecret) {
        throw new Error('Missing GREDICE_JWT_SIGN_SECRET');
    }
    return Buffer.from(signSecret, 'base64');
}

type User = {
    id: string;
    userName: string;
    accountIds: string[];
    role: string;
};

async function getUser(id: string): Promise<User | null> {
    const user = await storageGetUser(id);
    if (!user) {
        return null;
    }

    return {
        id: user.id,
        userName: user.userName,
        accountIds: user.accounts.map((accountUsers) => accountUsers.accountId),
        role: user.role,
    };
}

export const {
    withAuth: baseWithAuth,
    createJwt,
    setCookie,
    auth: baseAuth,
    clearCookie,
    verifyJwt,
} = initRbac(
    initAuth({
        security: {
            expiry: accessTokenExpiryMs,
        },
        jwt: {
            namespace: 'gredice',
            issuer: 'api',
            audience: 'web',
            jwtSecretFactory,
        },
        cookie: {
            name: 'gredice_session',
        },
        getUser,
    }),
);
