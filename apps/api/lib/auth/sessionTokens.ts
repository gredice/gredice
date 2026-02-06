import { createRefreshToken, revokeRefreshToken } from '@gredice/storage';
import { createJwt } from './auth';
import { accessTokenExpiry } from './sessionConfig';

export async function issueSessionTokens(userId: string) {
    const accessToken = await createJwt(userId, accessTokenExpiry);
    const refreshToken = await createRefreshToken(userId);
    return { accessToken, refreshToken };
}

export function revokeSessionToken(refreshToken: string) {
    return revokeRefreshToken(refreshToken);
}
