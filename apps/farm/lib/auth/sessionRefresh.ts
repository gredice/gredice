import { doUseRefreshToken } from '@gredice/storage';
import { cookies } from 'next/headers';
import { createJwt, setCookie, verifyJwt } from './baseAuth';
import {
    clearRefreshCookie,
    getRefreshTokenCookie,
    setRefreshCookie,
} from './refreshCookies';
import { accessTokenExpiry } from './sessionConfig';

async function isAccessTokenValid(token: string) {
    const { result, error } = await verifyJwt(token);
    if (error || !result?.payload?.sub) {
        return false;
    }
    return true;
}

export async function refreshSessionIfNeeded() {
    const accessToken = (await cookies()).get('gredice_session')?.value;
    if (accessToken && (await isAccessTokenValid(accessToken))) {
        return accessToken;
    }

    const refreshToken = await getRefreshTokenCookie();
    if (!refreshToken) {
        return null;
    }

    const refreshed = await doUseRefreshToken(refreshToken);
    if (!refreshed) {
        await clearRefreshCookie();
        return null;
    }

    const newAccessToken = await createJwt(refreshed.userId, accessTokenExpiry);
    await setCookie(newAccessToken);
    await setRefreshCookie(refreshToken);
    return newAccessToken;
}
