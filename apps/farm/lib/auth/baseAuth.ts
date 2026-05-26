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
    auth: baseAuth,
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
            name: sessionCookieName,
        },
        getUser,
    }),
);

/**
 * Set the session cookie with domain scoping for cross-subdomain SSO.
 * Overrides the shared auth setCookie helper, which does not support domain scoping.
 */
export async function setCookie(value: Promise<string> | string) {
    const cookieStore = await cookies();
    const cookieSettings = await authCookieSettings();
    cookieStore.set(sessionCookieName, await value, {
        secure: cookieSettings.secure,
        httpOnly: true,
        sameSite: 'lax',
        domain: cookieSettings.domain,
        expires: new Date(Date.now() + accessTokenExpiryMs),
    });
}

/**
 * Clear the session cookie (including domain-scoped cookie for SSO).
 * Overrides the shared auth clearCookie helper, which does not support domain scoping.
 */
export async function clearCookie() {
    const cookieStore = await cookies();
    const cookieSettings = await authCookieSettings();
    cookieStore.set(sessionCookieName, '', {
        secure: cookieSettings.secure,
        httpOnly: true,
        sameSite: 'lax',
        domain: cookieSettings.domain,
        maxAge: 0,
    });
}
