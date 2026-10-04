import { headers } from 'next/headers';
import { setCookie } from '../../../lib/auth/auth';
import { setRefreshCookie } from '../../../lib/auth/refreshCookies';

export async function POST(request: Request) {
    const headersList = await headers();
    const origin = headersList.get('origin');
    const secFetchSite = headersList.get('sec-fetch-site');
    const requestUrl = new URL(request.url);

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

    if (origin) {
        if (origin === 'null') {
            console.error('CSRF check failed: forbidden null Origin header');
            return new Response('Forbidden', { status: 403 });
        }

        let originUrl: URL;
        try {
            originUrl = new URL(origin);
        } catch (error) {
            console.error(
                'CSRF check failed: invalid Origin header',
                origin,
                error,
            );
            return new Response('Forbidden', { status: 403 });
        }

        const requestOrigin = requestUrl.origin;
        const isSameOrigin =
            originUrl.origin === requestOrigin ||
            (isLocalhost(originUrl.hostname) &&
                isLocalhost(requestUrl.hostname) &&
                originUrl.port === requestUrl.port &&
                originUrl.protocol === requestUrl.protocol);

        if (!isSameOrigin) {
            console.error(
                'CSRF check failed: origin mismatch',
                origin,
                requestOrigin,
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

function isLocalhost(hostname: string): boolean {
    return (
        hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname === '[::1]'
    );
}
