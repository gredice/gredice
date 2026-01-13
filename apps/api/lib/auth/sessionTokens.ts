import {
    createRefreshToken,
    revokeRefreshToken,
    useRefreshToken,
} from '@gredice/storage';
import { createJwt } from './auth';
import { accessTokenExpiry } from './sessionConfig';

export async function issueSessionTokens(userId: string) {
    const accessToken = await createJwt(userId, accessTokenExpiry);
    const refreshToken = await createRefreshToken(userId);
    return { accessToken, refreshToken };
}

export async function refreshSessionTokens(refreshToken: string) {
    const refreshed = await useRefreshToken(refreshToken);
    if (!refreshed) {
        return null;
    }

    // Revoke the old refresh token and create a new one (token rotation)
    await revokeRefreshToken(refreshToken);
    const newRefreshToken = await createRefreshToken(refreshed.userId);
    const accessToken = await createJwt(refreshed.userId, accessTokenExpiry);

    return { accessToken, refreshToken: newRefreshToken };
}

export function revokeSessionToken(refreshToken: string) {
    return revokeRefreshToken(refreshToken);
}
