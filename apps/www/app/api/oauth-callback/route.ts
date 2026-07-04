import { cookies, headers } from 'next/headers';
import { authCookieSettings } from '../../../lib/authCookieSecurity';

const accessTokenExpiryMs = 15 * 60 * 1000;
const refreshTokenExpiryMs = 30 * 24 * 60 * 60 * 1000;

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
            console.error(
                'CSRF check failed: null Origin header is not allowed',
            );
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

        const isSameOrigin =
            originUrl.origin === requestUrl.origin ||
            (isLocalhost(originUrl.hostname) &&
                isLocalhost(requestUrl.hostname) &&
                originUrl.port === requestUrl.port &&
                originUrl.protocol === requestUrl.protocol);

        if (!isSameOrigin) {
            console.error(
                'CSRF check failed: origin mismatch',
                origin,
                requestUrl.origin,
            );
            return new Response('Forbidden', { status: 403 });
        }
    }

    const body: unknown = await request.json();
    if (
        !body ||
        typeof body !== 'object' ||
        !('token' in body) ||
        typeof body.token !== 'string'
    ) {
        return new Response('Token is required', { status: 400 });
    }

    const cookieStore = await cookies();
    const cookieSettings = await authCookieSettings();

    cookieStore.set('gredice_session', body.token, {
        domain: cookieSettings.domain,
        expires: new Date(Date.now() + accessTokenExpiryMs),
        httpOnly: true,
        sameSite: 'lax',
        secure: cookieSettings.secure,
    });

    if ('refreshToken' in body && typeof body.refreshToken === 'string') {
        cookieStore.set('gredice_refresh', body.refreshToken, {
            domain: cookieSettings.domain,
            expires: new Date(Date.now() + refreshTokenExpiryMs),
            httpOnly: true,
            sameSite: 'lax',
            secure: cookieSettings.secure,
        });
    }

    return Response.json({ success: true });
}

function isLocalhost(hostname: string): boolean {
    return (
        hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname === '[::1]'
    );
}
