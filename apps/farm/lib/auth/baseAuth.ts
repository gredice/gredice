import 'server-only';

import { getUser as storageGetUser } from '@gredice/storage';
import { initAuth, initRbac } from '@signalco/auth-server';
import { cookies } from 'next/headers';
import {
    accessTokenExpiryMs,
    cookieDomain,
    sessionCookieName,
} from './sessionConfig';

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
 * Overrides @signalco/auth-server's built-in setCookie which doesn't support domain.
 */
export async function setCookie(value: Promise<string> | string) {
    const cookieStore = await cookies();
    cookieStore.set(sessionCookieName, await value, {
        secure: true,
        httpOnly: true,
        sameSite: 'lax',
        domain: cookieDomain,
        expires: new Date(Date.now() + accessTokenExpiryMs),
    });
}

/**
 * Clear the session cookie (including domain-scoped cookie for SSO).
 * Overrides @signalco/auth-server's built-in clearCookie which doesn't support domain.
 */
export async function clearCookie() {
    const cookieStore = await cookies();
    cookieStore.set(sessionCookieName, '', {
        secure: true,
        httpOnly: true,
        sameSite: 'lax',
        domain: cookieDomain,
        maxAge: 0,
    });
}
