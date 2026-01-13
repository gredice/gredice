import { cookies } from 'next/headers';
import { refreshTokenCookieName, refreshTokenExpiryMs } from './sessionConfig';

export function getRefreshTokenCookie() {
    const value = cookies().get(refreshTokenCookieName)?.value;
    return value ?? null;
}

export function setRefreshCookie(token: string) {
    cookies().set(refreshTokenCookieName, token, {
        httpOnly: true,
        secure: true,
        sameSite: 'Strict',
        expires: new Date(Date.now() + refreshTokenExpiryMs),
    });
}

export function clearRefreshCookie() {
    cookies().delete(refreshTokenCookieName);
}
