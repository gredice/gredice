import { cookies, headers } from 'next/headers';

const accessTokenExpiryMs = 15 * 60 * 1000;
const refreshTokenExpiryMs = 30 * 24 * 60 * 60 * 1000;
const cookieDomain = process.env.COOKIE_DOMAIN || undefined;

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
        // Treat explicit "null" origin as forbidden (e.g., some sandboxed contexts)
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

        const requestOrigin = requestUrl.origin;

        // Check if origins match, treating localhost and 127.0.0.1 as equivalent
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

    const cookieStore = await cookies();

    cookieStore.set('gredice_session', token, {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        domain: cookieDomain,
        expires: new Date(Date.now() + accessTokenExpiryMs),
    });

    if (refreshToken) {
        cookieStore.set('gredice_refresh', refreshToken, {
            httpOnly: true,
            secure: true,
            sameSite: 'lax',
            domain: cookieDomain,
            expires: new Date(Date.now() + refreshTokenExpiryMs),
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
