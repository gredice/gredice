import { createRefreshToken, doUseRefreshToken } from '@gredice/storage';
import { cookies } from 'next/headers';
import { createJwt, setCookie } from '../../../../lib/auth/auth';
import { clearImpersonationCookies } from '../../../../lib/auth/impersonationCookies';
import { setRefreshCookie } from '../../../../lib/auth/refreshCookies';
import { impersonationRefreshCookieName } from '../../../../lib/auth/sessionConfig';

const allowedOrigins = [
    'https://app.gredice.com',
    'https://app.gredice.test',
    'https://www.gredice.com',
    'https://www.gredice.test',
    'https://vrt.gredice.com',
    'https://vrt.gredice.test',
    'https://farma.gredice.com',
    'https://farma.gredice.test',
];

function getAdminUrl(request: Request) {
    const url = new URL(request.url);
    if (url.hostname.includes('.test')) {
        return 'https://app.gredice.test/admin/users';
    }
    return 'https://app.gredice.com/admin/users';
}

export async function POST(request: Request) {
    const origin = request.headers.get('Origin');
    if (!origin || !allowedOrigins.includes(origin)) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), {
            status: 403,
            headers: { 'Content-Type': 'application/json' },
        });
    }

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
