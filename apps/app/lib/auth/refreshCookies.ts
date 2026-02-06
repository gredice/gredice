import { cookies } from 'next/headers';
import { refreshTokenCookieName, refreshTokenExpiryMs } from './sessionConfig';

export async function getRefreshTokenCookie() {
    const cookieStore = await cookies();
    const value = cookieStore.get(refreshTokenCookieName)?.value;
    return value ?? null;
}

export async function setRefreshCookie(token: string) {
    const cookieStore = await cookies();
    cookieStore.set(refreshTokenCookieName, token, {
        httpOnly: true,
        secure: true,
        sameSite: 'strict',
        expires: new Date(Date.now() + refreshTokenExpiryMs),
    });
}

export async function clearRefreshCookie() {
    const cookieStore = await cookies();
    cookieStore.delete(refreshTokenCookieName);
}
