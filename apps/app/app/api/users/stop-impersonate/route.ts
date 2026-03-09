import { createRefreshToken, doUseRefreshToken } from '@gredice/storage';
import { cookies } from 'next/headers';
import { createJwt, setCookie } from '../../../../lib/auth/auth';
import { setRefreshCookie } from '../../../../lib/auth/refreshCookies';
import {
    cookieDomain,
    impersonationFlagCookieName,
    impersonationRefreshCookieName,
} from '../../../../lib/auth/sessionConfig';

function getAdminUrl(request: Request) {
    const url = new URL(request.url);
    if (url.hostname.includes('.test')) {
        return 'https://app.gredice.test/admin/users';
    }
    return 'https://app.gredice.com/admin/users';
}

export async function GET(request: Request) {
    const cookieStore = await cookies();

    // Read the admin's backed-up refresh token
    const adminRefreshToken = cookieStore.get(
        impersonationRefreshCookieName,
    )?.value;
    if (!adminRefreshToken) {
        return new Response(
            JSON.stringify({ error: 'No active impersonation session' }),
            { status: 400, headers: { 'Content-Type': 'application/json' } },
        );
    }

    // Validate the admin's refresh token and get the admin userId
    const refreshResult = await doUseRefreshToken(adminRefreshToken);
    if (!refreshResult) {
        // Backup token is invalid/expired — clear impersonation cookies and redirect
        clearImpersonationCookies(cookieStore);
        return Response.redirect(getAdminUrl(request));
    }

    // Create new session tokens for the admin
    const [accessToken, newRefreshToken] = await Promise.all([
        createJwt(refreshResult.userId),
        createRefreshToken(refreshResult.userId),
    ]);

    // Restore admin session
    await setCookie(accessToken);
    await setRefreshCookie(newRefreshToken);

    // Clear impersonation cookies
    clearImpersonationCookies(cookieStore);

    return Response.redirect(getAdminUrl(request));
}

function clearImpersonationCookies(
    cookieStore: Awaited<ReturnType<typeof cookies>>,
) {
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
