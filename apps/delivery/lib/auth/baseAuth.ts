import 'server-only';

import { initAuth, initRbac } from '@gredice/auth';
import { getUser as storageGetUser } from '@gredice/storage';
import { cookies } from 'next/headers';
import { authCookieSettings } from './cookieSecurity';
import { accessTokenExpiryMs, sessionCookieName } from './sessionConfig';

function jwtSecretFactory() {
    const signSecret = process.env.GREDICE_JWT_SIGN_SECRET;
    if (!signSecret) {
        throw new Error('Missing GREDICE_JWT_SIGN_SECRET');
    }
    return Buffer.from(signSecret, 'base64');
}

async function getUser(id: string) {
    const user = await storageGetUser(id);
    if (!user) return null;
    return {
        id: user.id,
        userName: user.userName,
        accountIds: user.accounts.map((accountUser) => accountUser.accountId),
        role: user.role,
    };
}

export const {
    withAuth: baseWithAuth,
    createJwt,
    auth: baseAuth,
    verifyJwt,
} = initRbac(
    initAuth({
        security: { expiry: accessTokenExpiryMs },
        jwt: {
            namespace: 'gredice',
            issuer: 'api',
            audience: 'web',
            jwtSecretFactory,
        },
        cookie: { name: sessionCookieName },
        getUser,
    }),
);

export async function setCookie(value: Promise<string> | string) {
    const cookieStore = await cookies();
    const settings = await authCookieSettings();
    cookieStore.set(sessionCookieName, await value, {
        secure: settings.secure,
        httpOnly: true,
        sameSite: 'lax',
        domain: settings.domain,
        expires: new Date(Date.now() + accessTokenExpiryMs),
    });
}

export async function clearCookie() {
    const cookieStore = await cookies();
    const settings = await authCookieSettings();
    cookieStore.set(sessionCookieName, '', {
        secure: settings.secure,
        httpOnly: true,
        sameSite: 'lax',
        domain: settings.domain,
        maxAge: 0,
    });
}
