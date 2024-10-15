import { getUser as storageGetUser } from '@gredice/storage';
import { initAuth } from '@signalco/auth-server';

function jwtSecretFactory() {
    const signSecret = process.env.GREDICE_JWT_SIGN_SECRET as string;
    return Buffer.from(signSecret, 'base64');
}

async function getUser(id: string) {
    const user = await storageGetUser(id);
    if (!user) {
        return null;
    }

    return {
        id: user.id,
        accountIds: user.accounts.map(accountUsers => accountUsers.accountId),
    }
}

export const { withAuth, createJwt, setCookie, auth } = initAuth({
    jwt: {
        namespace: 'gredice',
        issuer: 'garden',
        jwtSecretFactory,
    },
    cookie: {
        name: 'gredice_session'
    },
    getUser
});