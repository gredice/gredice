import { cookies } from 'next/headers';
import { authCookieSettings } from './cookieSecurity';
import { refreshTokenCookieName, refreshTokenExpiryMs } from './sessionConfig';

export async function getRefreshTokenCookie() {
    return (await cookies()).get(refreshTokenCookieName)?.value ?? null;
}

export async function setRefreshCookie(token: string) {
    const cookieStore = await cookies();
    const settings = await authCookieSettings();
    cookieStore.set(refreshTokenCookieName, token, {
        httpOnly: true,
        secure: settings.secure,
        sameSite: 'lax',
        domain: settings.domain,
        expires: new Date(Date.now() + refreshTokenExpiryMs),
    });
}

export async function clearRefreshCookie() {
    const cookieStore = await cookies();
    const settings = await authCookieSettings();
    cookieStore.set(refreshTokenCookieName, '', {
        httpOnly: true,
        secure: settings.secure,
        sameSite: 'lax',
        domain: settings.domain,
        maxAge: 0,
    });
}
