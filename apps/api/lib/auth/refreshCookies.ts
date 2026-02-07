import type { Context } from 'hono';
import { deleteCookie, setCookie } from 'hono/cookie';
import { cookieDomain, refreshTokenCookieName } from './sessionConfig';

const refreshTokenExpiryMs = 30 * 24 * 60 * 60 * 1000;

export function setRefreshCookie(context: Context, token: string) {
    setCookie(context, refreshTokenCookieName, token, {
        secure: true,
        httpOnly: true,
        sameSite: 'Lax',
        domain: cookieDomain,
        expires: new Date(Date.now() + refreshTokenExpiryMs),
    });
}

export function clearRefreshCookie(context: Context) {
    deleteCookie(context, refreshTokenCookieName, {
        domain: cookieDomain,
    });
}
