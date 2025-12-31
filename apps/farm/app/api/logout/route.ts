import { revokeRefreshToken } from '@gredice/storage';
import { clearCookie } from '../../../lib/auth/auth';
import {
    clearRefreshCookie,
    getRefreshTokenCookie,
} from '../../../lib/auth/refreshCookies';

export async function POST() {
    const refreshToken = getRefreshTokenCookie();
    if (refreshToken) {
        await revokeRefreshToken(refreshToken);
    }
    await clearCookie();
    clearRefreshCookie();

    return new Response(null, { status: 200 });
}
