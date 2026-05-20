import 'server-only';
import { createHmac } from 'node:crypto';
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

type AccountBoundJwtPayload = {
    sub: string;
    accountId: string;
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

const rbac = initRbac(
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

export const { withAuth: baseWithAuth, auth: baseAuth, verifyJwt } = rbac;

type CreateJwtExpiration = Parameters<typeof rbac.createJwt>[1];
type CreateJwtOverride = Parameters<typeof rbac.createJwt>[2];
type AccountBoundJwtExpiration = '72h' | number | Date;

function isAccountBoundJwtPayload(
    value: string | AccountBoundJwtPayload,
): value is AccountBoundJwtPayload {
    return typeof value !== 'string';
}

function resolveAccountBoundExpiration(
    expirationTime: CreateJwtExpiration | AccountBoundJwtExpiration | undefined,
): AccountBoundJwtExpiration {
    if (expirationTime === undefined || expirationTime === '72h') {
        return '72h';
    }

    if (typeof expirationTime === 'number' || expirationTime instanceof Date) {
        return expirationTime;
    }

    throw new Error('Unsupported account-bound JWT expiration.');
}

function resolveExpirationTime(
    expirationTime: AccountBoundJwtExpiration,
    issuedAt: number,
) {
    if (expirationTime instanceof Date) {
        return Math.floor(expirationTime.getTime() / 1000);
    }

    if (typeof expirationTime === 'number') {
        return issuedAt + Math.floor(expirationTime / 1000);
    }

    return issuedAt + 72 * 60 * 60;
}

function encodeJwtPart(value: Record<string, unknown>) {
    return Buffer.from(JSON.stringify(value)).toString('base64url');
}

async function createAccountBoundJwt(
    payload: AccountBoundJwtPayload,
    expirationTime: AccountBoundJwtExpiration,
) {
    const issuedAt = Math.floor(Date.now() / 1000);
    const signingInput = [
        encodeJwtPart({ alg: 'HS256' }),
        encodeJwtPart({
            accountId: payload.accountId,
            aud: 'urn:gredice:audience:web',
            exp: resolveExpirationTime(expirationTime, issuedAt),
            iat: issuedAt,
            iss: 'urn:gredice:issuer:api',
            sub: payload.sub,
        }),
    ].join('.');
    const signature = createHmac('sha256', await jwtSecretFactory())
        .update(signingInput)
        .digest('base64url');

    return `${signingInput}.${signature}`;
}

export function createJwt(
    userId: string,
    expirationTime?: CreateJwtExpiration,
    overrideConfig?: CreateJwtOverride,
): Promise<string>;
export function createJwt(
    payload: AccountBoundJwtPayload,
    expirationTime?: AccountBoundJwtExpiration,
): Promise<string>;
export function createJwt(
    payload: string | AccountBoundJwtPayload,
    expirationTime?: CreateJwtExpiration | AccountBoundJwtExpiration,
    overrideConfig?: CreateJwtOverride,
) {
    if (isAccountBoundJwtPayload(payload)) {
        return createAccountBoundJwt(
            payload,
            resolveAccountBoundExpiration(expirationTime),
        );
    }

    return rbac.createJwt(payload, expirationTime, overrideConfig);
}

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
