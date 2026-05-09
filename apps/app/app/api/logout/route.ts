import { revokeRefreshToken } from '@gredice/storage';
import { cookies } from 'next/headers';
import { clearCookie } from '../../../lib/auth/auth';
import { clearImpersonationCookies } from '../../../lib/auth/impersonationCookies';
import {
    clearRefreshCookie,
    getRefreshTokenCookie,
} from '../../../lib/auth/refreshCookies';

export async function POST() {
    const refreshToken = await getRefreshTokenCookie();
    if (refreshToken) {
        try {
            await revokeRefreshToken(refreshToken);
        } catch (cause) {
            console.error(
                'Failed to revoke refresh token during logout',
                cause,
            );
        }
    }

    await clearCookie();
    await clearRefreshCookie();
    clearImpersonationCookies(await cookies());

    return new Response(null, { status: 200 });
}
