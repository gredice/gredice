import 'server-only';
import { getUser as storageGetUser } from '@gredice/storage';
import { initAuth, initRbac } from '@signalco/auth-server';

function jwtSecretFactory() {
    const signSecret = process.env.GREDICE_JWT_SIGN_SECRET as string;
    return Buffer.from(signSecret, 'base64');
}

type User = {
    id: string;
    userName: string;
    accountIds: string[];
    role: string;
}

async function getUser(id: string): Promise<User | null> {
    const user = await storageGetUser(id);
    if (!user) {
        return null;
    }

    return {
        id: user.id,
        userName: user.userName,
        accountIds: user.accounts.map(accountUsers => accountUsers.accountId),
        role: user.role,
    }
}

export const { withAuth, createJwt, setCookie, auth, clearCookie } = initRbac(initAuth({
    security: {
        expiry: 60 * 60 * 1000
    },
    jwt: {
        namespace: 'gredice',
        issuer: 'api',
        jwtSecretFactory,
    },
    cookie: {
        name: 'gredice_session'
    },
    getUser
}));
