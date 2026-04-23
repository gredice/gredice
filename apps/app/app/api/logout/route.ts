import { revokeRefreshToken } from '@gredice/storage';
import { cookies } from 'next/headers';
import { clearCookie } from '../../../lib/auth/auth';
import {
    clearRefreshCookie,
    getRefreshTokenCookie,
} from '../../../lib/auth/refreshCookies';
import {
    cookieDomain,
    impersonationFlagCookieName,
    impersonationRefreshCookieName,
} from '../../../lib/auth/sessionConfig';

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
    await clearImpersonationCookies();

    return new Response(null, { status: 200 });
}

async function clearImpersonationCookies() {
    const cookieStore = await cookies();
    cookieStore.set(impersonationRefreshCookieName, '', {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        domain: cookieDomain,
        maxAge: 0,
    });
    cookieStore.set(impersonationFlagCookieName, '', {
        httpOnly: false,
        secure: true,
        sameSite: 'lax',
        domain: cookieDomain,
        maxAge: 0,
    });
}
