import {
    DeliveryAvailabilityLookupError,
    lookupDeliveryAvailability,
} from '../../../../lib/publicDeliveryQuote';

type RateLimitBucket = { count: number; resetAt: number };

const maximumRequestBodyBytes = 512;
const rateLimitRequests = 10;
const rateLimitWindowMilliseconds = 60_000;
const rateLimitStore = new Map<string, RateLimitBucket>();
const productionOrigins = new Set([
    'https://gredice.com',
    'https://www.gredice.com',
]);

function headerListValue(value: string | null, index: 'first' | 'last') {
    const values = value?.split(',').map((item) => item.trim()) ?? [];
    return (index === 'first' ? values[0] : values.at(-1)) || null;
}

function clientAddress(request: Request) {
    return (
        headerListValue(
            request.headers.get('x-vercel-forwarded-for'),
            'first',
        ) ??
        headerListValue(request.headers.get('x-forwarded-for'), 'last') ??
        request.headers.get('x-real-ip') ??
        'unknown'
    );
}

function checkRateLimit(key: string) {
    const now = Date.now();
    if (rateLimitStore.size > 1_000) {
        for (const [storedKey, storedBucket] of rateLimitStore) {
            if (storedBucket.resetAt <= now) rateLimitStore.delete(storedKey);
        }
    }
    const bucket = rateLimitStore.get(key);
    if (!bucket || bucket.resetAt <= now) {
        rateLimitStore.set(key, {
            count: 1,
            resetAt: now + rateLimitWindowMilliseconds,
        });
        return { allowed: true, resetAt: now + rateLimitWindowMilliseconds };
    }
    if (bucket.count >= rateLimitRequests) {
        return { allowed: false, resetAt: bucket.resetAt };
    }

    bucket.count += 1;
    return { allowed: true, resetAt: bucket.resetAt };
}

function isLocalhost(hostname: string) {
    return (
        hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname === '[::1]'
    );
}

function isLocalPublicSite(hostname: string) {
    return hostname === 'gredice.test' || hostname === 'www.gredice.test';
}

function isPublicSitePreview(hostname: string) {
    // `33fa1ur95` is the stable Vercel deployment prefix for gredice/www.
    return (
        hostname.endsWith('-gredice.vercel.app') &&
        (hostname.startsWith('33fa1ur95-') || hostname.startsWith('www-'))
    );
}

function allowedOrigin(value: string | null) {
    if (!value || value === 'null') return null;

    try {
        const url = new URL(value);
        if (url.origin !== value) return null;
        if (productionOrigins.has(url.origin)) return url.origin;
        if (url.protocol === 'http:' && isLocalhost(url.hostname)) {
            return url.origin;
        }
        if (
            (url.protocol === 'http:' || url.protocol === 'https:') &&
            isLocalPublicSite(url.hostname)
        ) {
            return url.origin;
        }
        if (url.protocol === 'https:' && isPublicSitePreview(url.hostname)) {
            return url.origin;
        }
    } catch {
        return null;
    }

    return null;
}

function responseHeaders(origin: string, headers?: HeadersInit) {
    const result = new Headers(headers);
    result.set('Access-Control-Allow-Headers', 'Content-Type');
    result.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    result.set('Access-Control-Allow-Origin', origin);
    result.set('Cache-Control', 'no-store');
    result.set('Vary', 'Origin');
    return result;
}

function jsonResponse(origin: string, body: unknown, init: ResponseInit = {}) {
    return Response.json(body, {
        ...init,
        headers: responseHeaders(origin, init.headers),
    });
}

function normalizedAddress(value: unknown) {
    if (typeof value !== 'string') return null;
    const address = value.trim().replaceAll(/\s+/g, ' ');
    return address.length >= 5 && address.length <= 200 ? address : null;
}

export function OPTIONS(request: Request) {
    const origin = allowedOrigin(request.headers.get('origin'));
    if (!origin) {
        return Response.json({ error: 'Forbidden.' }, { status: 403 });
    }

    return new Response(null, {
        status: 204,
        headers: responseHeaders(origin),
    });
}

export async function POST(request: Request) {
    const origin = allowedOrigin(request.headers.get('origin'));
    if (!origin) {
        return Response.json({ error: 'Forbidden.' }, { status: 403 });
    }
    if (!request.headers.get('content-type')?.startsWith('application/json')) {
        return jsonResponse(
            origin,
            { error: 'Unsupported media type.' },
            { status: 415 },
        );
    }

    const requestBody = await request.text();
    if (
        new TextEncoder().encode(requestBody).byteLength >
        maximumRequestBodyBytes
    ) {
        return jsonResponse(
            origin,
            { error: 'Request body is too large.' },
            { status: 413 },
        );
    }

    let body: unknown;
    try {
        body = JSON.parse(requestBody);
    } catch {
        return jsonResponse(
            origin,
            { error: 'Invalid body.' },
            { status: 400 },
        );
    }
    const address =
        body && typeof body === 'object' && 'address' in body
            ? normalizedAddress(body.address)
            : null;
    if (!address) {
        return jsonResponse(
            origin,
            { error: 'Invalid address.' },
            { status: 400 },
        );
    }

    const rateLimit = checkRateLimit(clientAddress(request));
    if (!rateLimit.allowed) {
        return jsonResponse(
            origin,
            { error: 'Rate limit exceeded.' },
            {
                status: 429,
                headers: {
                    'Retry-After': Math.max(
                        1,
                        Math.ceil((rateLimit.resetAt - Date.now()) / 1_000),
                    ).toString(),
                },
            },
        );
    }

    try {
        return jsonResponse(origin, await lookupDeliveryAvailability(address));
    } catch (error) {
        if (
            error instanceof DeliveryAvailabilityLookupError &&
            error.code === 'not-found'
        ) {
            return jsonResponse(
                origin,
                { error: 'Address not found.' },
                { status: 404 },
            );
        }
        return jsonResponse(
            origin,
            { error: 'Delivery lookup unavailable.' },
            { status: 503 },
        );
    }
}
