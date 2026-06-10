import { createRefreshToken, doUseRefreshToken } from '@gredice/storage';
import { cookies } from 'next/headers';
import { createJwt, setCookie } from '../../../../lib/auth/auth';
import { clearImpersonationCookies } from '../../../../lib/auth/impersonationCookies';
import { setRefreshCookie } from '../../../../lib/auth/refreshCookies';
import { impersonationRefreshCookieName } from '../../../../lib/auth/sessionConfig';

const allowedOrigins = [
    'app.gredice.com',
    'app.gredice.test',
    'www.gredice.com',
    'www.gredice.test',
    'vrt.gredice.com',
    'vrt.gredice.test',
    'farma.gredice.com',
    'farma.gredice.test',
];

function getAdminUrl(request: Request) {
    const url = new URL(request.url);
    if (url.hostname.includes('.test')) {
        url.hostname = 'app.gredice.test';
        url.pathname = '/admin/users';
        url.search = '';
        url.hash = '';
        return url.toString();
    }
    return 'https://app.gredice.com/admin/users';
}

function isAllowedOrigin(origin: string | null) {
    if (!origin) {
        return false;
    }

    try {
        const url = new URL(origin);
        return (
            url.protocol === 'https:' && allowedOrigins.includes(url.hostname)
        );
    } catch {
        return false;
    }
}

export async function POST(request: Request) {
    const origin = request.headers.get('Origin');
    if (!isAllowedOrigin(origin)) {
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
        await clearImpersonationCookies(cookieStore);
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
    await clearImpersonationCookies(cookieStore);

    return Response.redirect(getAdminUrl(request));
}
