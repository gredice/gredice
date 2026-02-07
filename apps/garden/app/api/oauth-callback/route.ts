import { cookies, headers } from 'next/headers';

const accessTokenExpiryMs = 15 * 60 * 1000;
const refreshTokenExpiryMs = 30 * 24 * 60 * 60 * 1000;

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

    const cookieStore = await cookies();

    cookieStore.set('gredice_session', token, {
        httpOnly: true,
        secure: true,
        sameSite: 'strict',
        expires: new Date(Date.now() + accessTokenExpiryMs),
    });

    if (refreshToken) {
        cookieStore.set('gredice_refresh', refreshToken, {
            httpOnly: true,
            secure: true,
            sameSite: 'strict',
            expires: new Date(Date.now() + refreshTokenExpiryMs),
        });
    }

    return Response.json({ success: true });
}
