import { createRefreshToken } from '@gredice/storage';
import { cookies } from 'next/headers';
import { createJwt, setCookie, withAuth } from '../../../../../lib/auth/auth';
import { authCookieSettings } from '../../../../../lib/auth/cookieSecurity';
import { setRefreshCookie } from '../../../../../lib/auth/refreshCookies';
import {
    accountCookieName,
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
        const cookieSettings = await authCookieSettings();

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
            secure: cookieSettings.secure,
            sameSite: 'lax',
            domain: cookieDomain,
            expires: new Date(Date.now() + refreshTokenExpiryMs),
        });

        // Set a non-httpOnly flag cookie so client-side code can detect impersonation
        cookieStore.set(impersonationFlagCookieName, '1', {
            httpOnly: false,
            secure: cookieSettings.secure,
            sameSite: 'lax',
            domain: cookieDomain,
            expires: new Date(Date.now() + refreshTokenExpiryMs),
        });

        // Reset the active account so the impersonated session chooses from the user's accounts.
        cookieStore.set(accountCookieName, '', {
            httpOnly: true,
            secure: cookieSettings.secure,
            sameSite: 'lax',
            domain: cookieSettings.domain,
            maxAge: 0,
        });

        // Create tokens for the impersonated user
        const [accessToken, refreshToken] = await Promise.all([
            createJwt(userId),
            createRefreshToken(userId),
        ]);
        await Promise.all([
            setCookie(accessToken),
            setRefreshCookie(refreshToken),
        ]);
        return new Response(null, { status: 201 });
    });
}
