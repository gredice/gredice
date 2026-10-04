import { cookies } from 'next/headers';
import { authCookieSettings } from './cookieSecurity';
import { refreshTokenCookieName, refreshTokenExpiryMs } from './sessionConfig';

export async function getRefreshTokenCookie() {
    const cookieStore = await cookies();
    const value = cookieStore.get(refreshTokenCookieName)?.value;
    return value ?? null;
}

export async function setRefreshCookie(token: string) {
    const cookieStore = await cookies();
    const cookieSettings = await authCookieSettings();
    cookieStore.set(refreshTokenCookieName, token, {
        httpOnly: true,
        secure: cookieSettings.secure,
        sameSite: 'lax',
        domain: cookieSettings.domain,
        expires: new Date(Date.now() + refreshTokenExpiryMs),
    });
}

export async function clearRefreshCookie() {
    const cookieStore = await cookies();
    const cookieSettings = await authCookieSettings();
    cookieStore.set(refreshTokenCookieName, '', {
        httpOnly: true,
        secure: cookieSettings.secure,
        sameSite: 'lax',
        domain: cookieSettings.domain,
        maxAge: 0,
    });
}
