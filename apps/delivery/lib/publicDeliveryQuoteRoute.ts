import { checkRateLimit } from '@vercel/firewall';
import {
    DeliveryAvailabilityLookupError,
    lookupDeliveryAvailability,
} from './publicDeliveryQuote';

type RateLimitCheck = (
    request: Request,
) => Promise<{ error?: 'blocked' | 'not-found'; rateLimited: boolean }>;

const maximumRequestBodyBytes = 512;
const rateLimitWindowSeconds = 60;
const productionOrigins = new Set([
    'https://gredice.com',
    'https://www.gredice.com',
]);

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

function isCustomPublicSitePreview(hostname: string) {
    const firstLabel = hostname.split('.')[0] ?? '';
    return (
        firstLabel.length <= 63 &&
        /^www-[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.preview\.gredice\.com$/.test(
            hostname,
        )
    );
}

function isVercelPublicSitePreview(hostname: string) {
    // `33fa1ur95` is the stable Vercel deployment prefix for gredice/www.
    return (
        hostname.endsWith('-gredice.vercel.app') &&
        (hostname.startsWith('33fa1ur95-') || hostname.startsWith('www-'))
    );
}

function isPublicSitePreview(hostname: string) {
    return (
        isCustomPublicSitePreview(hostname) ||
        isVercelPublicSitePreview(hostname)
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

const platformRateLimitCheck: RateLimitCheck = (request) =>
    checkRateLimit('delivery-quote', { request });

export function createPublicDeliveryQuoteHandlers(
    rateLimitCheck: RateLimitCheck = platformRateLimitCheck,
) {
    function OPTIONS(request: Request) {
        const origin = allowedOrigin(request.headers.get('origin'));
        if (!origin) {
            return Response.json({ error: 'Forbidden.' }, { status: 403 });
        }

        return new Response(null, {
            status: 204,
            headers: responseHeaders(origin),
        });
    }

    async function POST(request: Request) {
        const origin = allowedOrigin(request.headers.get('origin'));
        if (!origin) {
            return Response.json({ error: 'Forbidden.' }, { status: 403 });
        }
        if (
            !request.headers.get('content-type')?.startsWith('application/json')
        ) {
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

        try {
            const rateLimit = await rateLimitCheck(request);
            if (rateLimit.rateLimited) {
                return jsonResponse(
                    origin,
                    { error: 'Rate limit exceeded.' },
                    {
                        status: 429,
                        headers: {
                            'Retry-After': rateLimitWindowSeconds.toString(),
                        },
                    },
                );
            }
            if (rateLimit.error) {
                return jsonResponse(
                    origin,
                    { error: 'Delivery lookup unavailable.' },
                    { status: 503 },
                );
            }
        } catch {
            return jsonResponse(
                origin,
                { error: 'Delivery lookup unavailable.' },
                { status: 503 },
            );
        }

        try {
            return jsonResponse(
                origin,
                await lookupDeliveryAvailability(address),
            );
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

    return { OPTIONS, POST };
}

const deliveryQuoteHandlers = createPublicDeliveryQuoteHandlers();

export const deliveryQuoteOptions = deliveryQuoteHandlers.OPTIONS;
export const deliveryQuotePost = deliveryQuoteHandlers.POST;
