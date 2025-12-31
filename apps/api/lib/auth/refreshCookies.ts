import type { Context } from 'hono';
import { deleteCookie, setCookie } from 'hono/cookie';
import { refreshTokenCookieName } from './sessionConfig';

const refreshTokenExpiryMs = 30 * 24 * 60 * 60 * 1000;

export function setRefreshCookie(context: Context, token: string) {
    setCookie(context, refreshTokenCookieName, token, {
        secure: true,
        httpOnly: true,
        sameSite: 'Strict',
        expires: new Date(Date.now() + refreshTokenExpiryMs),
    });
}

export function clearRefreshCookie(context: Context) {
    deleteCookie(context, refreshTokenCookieName);
}
