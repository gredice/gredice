import 'server-only';
import { getUser as storageGetUser } from '@gredice/storage';
import { initAuth, initRbac } from '@signalco/auth-server';
import { setCookie as honoSetCookie, deleteCookie } from 'hono/cookie';
import { Context } from 'hono';

export function jwtSecretFactory() {
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

// TODO: Move to signalco/auth-server/hono
export async function setCookie(context: Context, value: Promise<string> | string) {
    honoSetCookie(context, 'gredice_session', await Promise.resolve(value), {
        secure: true,
        httpOnly: true,
        sameSite: 'Strict',
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000)
    });
}

// TODO: Move to signalco/auth-server/hono
export async function clearCookie(context: Context) {
    deleteCookie(context, 'gredice_session');
}

export const { withAuth, createJwt, auth } = initRbac(initAuth({
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
