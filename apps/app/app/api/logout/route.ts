import { revokeRefreshToken } from '@gredice/storage';
import { clearCookie } from '../../../lib/auth/auth';
import {
    clearRefreshCookie,
    getRefreshTokenCookie,
} from '../../../lib/auth/refreshCookies';

export async function POST() {
    const refreshToken = await getRefreshTokenCookie();
    if (refreshToken) {
        await revokeRefreshToken(refreshToken);
    }
    await clearCookie();
    await clearRefreshCookie();

    return new Response(null, { status: 200 });
}
