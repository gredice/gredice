import { headers } from 'next/headers';
import { setCookie } from '../../../lib/auth/auth';
import { setRefreshCookie } from '../../../lib/auth/refreshCookies';

function isLoopback(hostname: string) {
    return ['localhost', '127.0.0.1', '[::1]'].includes(hostname);
}

export async function POST(request: Request) {
    const requestHeaders = await headers();
    const secFetchSite = requestHeaders.get('sec-fetch-site');
    if (
        secFetchSite &&
        secFetchSite !== 'same-origin' &&
        secFetchSite !== 'same-site'
    ) {
        return new Response('Forbidden', { status: 403 });
    }

    const origin = requestHeaders.get('origin');
    if (origin) {
        try {
            const originUrl = new URL(origin);
            const requestUrl = new URL(request.url);
            const sameOrigin =
                originUrl.origin === requestUrl.origin ||
                (isLoopback(originUrl.hostname) &&
                    isLoopback(requestUrl.hostname) &&
                    originUrl.port === requestUrl.port);
            if (!sameOrigin) return new Response('Forbidden', { status: 403 });
        } catch {
            return new Response('Forbidden', { status: 403 });
        }
    }

    const body: unknown = await request.json().catch(() => null);
    if (
        typeof body !== 'object' ||
        body === null ||
        !('token' in body) ||
        typeof body.token !== 'string'
    ) {
        return Response.json({ error: 'token_required' }, { status: 400 });
    }
    if ('refreshToken' in body && typeof body.refreshToken === 'string') {
        await setRefreshCookie(body.refreshToken);
    }
    await setCookie(body.token);
    return Response.json({ success: true });
}
