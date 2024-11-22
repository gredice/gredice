import { getUser as storageGetUser } from '@gredice/storage';
import { initAuth, initRbac } from '@signalco/auth-server';

function jwtSecretFactory() {
    const signSecret = process.env.GREDICE_JWT_SIGN_SECRET as string;
    return Buffer.from(signSecret, 'base64');
}

type User = {
    id: string;
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
        accountIds: user.accounts.map(accountUsers => accountUsers.accountId),
        role: user.role,
    }
}

export const { withAuth, createJwt, setCookie, auth } = initRbac(initAuth({
    jwt: {
        namespace: 'gredice',
        issuer: 'app',
        jwtSecretFactory,
    },
    cookie: {
        name: 'gredice_session'
    },
    getUser
}));
