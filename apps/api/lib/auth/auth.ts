import 'server-only';
import { getUser as storageGetUser } from '@gredice/storage';
import { initAuth, initRbac } from '@signalco/auth-server';
import type { Context } from 'hono';
import { deleteCookie, setCookie as honoSetCookie } from 'hono/cookie';
import {
    accessTokenExpiryMs,
    cookieDomain,
    sessionCookieName,
} from './sessionConfig';

export function jwtSecretFactory() {
    const signSecret = process.env.GREDICE_JWT_SIGN_SECRET;
    if (!signSecret) {
        throw new Error('Missing GREDICE_JWT_SIGN_SECRET');
    }
    return Buffer.from(signSecret, 'base64');
}

type User = {
    id: string;
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
        accountIds: user.accounts.map((accountUsers) => accountUsers.accountId),
        role: user.role,
    };
}

// TODO: Move to signalco/auth-server/hono
export async function setCookie(
    context: Context,
    value: Promise<string> | string,
) {
    honoSetCookie(context, sessionCookieName, await value, {
        secure: true,
        httpOnly: true,
        sameSite: 'Lax',
        domain: cookieDomain,
        expires: new Date(Date.now() + accessTokenExpiryMs),
    });
}

// TODO: Move to signalco/auth-server/hono
export async function clearCookie(context: Context) {
    deleteCookie(context, sessionCookieName, {
        domain: cookieDomain,
    });
}

export const { withAuth, createJwt, verifyJwt, auth } = initRbac(
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
