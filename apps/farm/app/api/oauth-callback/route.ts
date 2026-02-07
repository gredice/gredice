import { headers } from 'next/headers';
import { setCookie } from '../../../lib/auth/auth';
import { setRefreshCookie } from '../../../lib/auth/refreshCookies';

export async function POST(request: Request) {
    // CSRF protection: validate Origin and Sec-Fetch-Site headers
    const headersList = await headers();
    const origin = headersList.get('origin');
    const secFetchSite = headersList.get('sec-fetch-site');
    const requestUrl = new URL(request.url);

    // Ensure request is same-origin or from the same site
    if (
        secFetchSite &&
        secFetchSite !== 'same-origin' &&
        secFetchSite !== 'same-site'
    ) {
        console.error(
            'CSRF check failed: invalid Sec-Fetch-Site header',
            secFetchSite,
        );
        return new Response('Forbidden', { status: 403 });
    }

    // Additional origin validation if Origin header is present
    if (origin) {
        const originUrl = new URL(origin);
        if (originUrl.origin !== requestUrl.origin) {
            console.error(
                'CSRF check failed: origin mismatch',
                origin,
                requestUrl.origin,
            );
            return new Response('Forbidden', { status: 403 });
        }
    }

    const body = await request.json();
    const { token, refreshToken } = body;
    if (!token) {
        return new Response('Token is required', { status: 400 });
    }

    if (refreshToken) {
        await setRefreshCookie(refreshToken);
    }
    await setCookie(token);

    return Response.json({ success: true });
}
