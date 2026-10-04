import { getRefreshTokenUserId, revokeRefreshToken } from '@gredice/storage';
import { cookies } from 'next/headers';
import {
    clearCookie,
    createFarmSessionIncarnation,
    verifyJwt,
} from '../../../lib/auth/auth';
import { collectFarmLoggedOutSessions } from '../../../lib/auth/logoutSessions';
import {
    clearRefreshCookie,
    getRefreshTokenCookie,
} from '../../../lib/auth/refreshCookies';
import { sessionCookieName } from '../../../lib/auth/sessionConfig';

async function getLoggedOutSessions(refreshToken: string | null) {
    const accessToken = (await cookies()).get(sessionCookieName)?.value ?? null;
    const accessTokenResult = accessToken ? await verifyJwt(accessToken) : null;
    const accessUserId = accessTokenResult?.result?.payload.sub;
    const refreshUser = refreshToken
        ? await getRefreshTokenUserId(refreshToken)
        : null;

    return collectFarmLoggedOutSessions({
        accessSessionIncarnation: accessToken
            ? createFarmSessionIncarnation(accessToken)
            : null,
        accessUserId: typeof accessUserId === 'string' ? accessUserId : null,
        refreshSessionIncarnation: refreshToken
            ? createFarmSessionIncarnation(refreshToken)
            : null,
        refreshUserId: refreshUser?.userId ?? null,
    });
}

export async function POST() {
    const refreshToken = await getRefreshTokenCookie();
    const loggedOutSessions = await getLoggedOutSessions(refreshToken);
    if (refreshToken) {
        await revokeRefreshToken(refreshToken);
    }
    await clearCookie();
    await clearRefreshCookie();

    return Response.json(
        { loggedOutSessions },
        { headers: { 'Cache-Control': 'no-store' } },
    );
}
