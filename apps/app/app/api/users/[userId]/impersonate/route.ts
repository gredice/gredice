import { createRefreshToken } from '@gredice/storage';
import { cookies } from 'next/headers';
import { createJwt, setCookie, withAuth } from '../../../../../lib/auth/auth';
import { setRefreshCookie } from '../../../../../lib/auth/refreshCookies';
import {
    cookieDomain,
    impersonationFlagCookieName,
    impersonationRefreshCookieName,
    refreshTokenCookieName,
    refreshTokenExpiryMs,
} from '../../../../../lib/auth/sessionConfig';

export async function POST(
    _request: Request,
    { params }: { params: Promise<{ userId: string }> },
) {
    const { userId } = await params;
    if (!userId) {
        return new Response(null, { status: 400 });
    }

    return await withAuth(['admin'], async () => {
        const cookieStore = await cookies();

        // Save the admin's current refresh token so we can restore the session later
        const adminRefreshToken = cookieStore.get(
            refreshTokenCookieName,
        )?.value;
        if (!adminRefreshToken) {
            return new Response(
                JSON.stringify({ error: 'No refresh token found' }),
                { status: 400 },
            );
        }

        // Store admin's refresh token in a backup cookie (httpOnly for security)
        cookieStore.set(impersonationRefreshCookieName, adminRefreshToken, {
            httpOnly: true,
            secure: true,
            sameSite: 'lax',
            domain: cookieDomain,
            expires: new Date(Date.now() + refreshTokenExpiryMs),
        });

        // Set a non-httpOnly flag cookie so client-side code can detect impersonation
        cookieStore.set(impersonationFlagCookieName, '1', {
            httpOnly: false,
            secure: true,
            sameSite: 'lax',
            domain: cookieDomain,
            expires: new Date(Date.now() + refreshTokenExpiryMs),
        });

        // Create tokens for the impersonated user
        const [accessToken, refreshToken] = await Promise.all([
            createJwt(userId),
            createRefreshToken(userId),
        ]);
        await setCookie(accessToken);
        setRefreshCookie(refreshToken);
        return new Response(null, { status: 201 });
    });
}
