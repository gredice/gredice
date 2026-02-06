import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';

/**
 * API Proxy Route
 * Proxies requests to api.gredice.com and forwards cookies to enable cookie-based auth.
 * This eliminates the need for localStorage token storage and prevents tokens in URLs.
 */

const API_BASE_URL =
    process.env.NEXT_PUBLIC_VERCEL_ENV === 'development'
        ? 'https://api.gredice.test'
        : 'https://api.gredice.com';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ path: string[] }> },
) {
    return proxyRequest(request, await params);
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ path: string[] }> },
) {
    return proxyRequest(request, await params);
}

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ path: string[] }> },
) {
    return proxyRequest(request, await params);
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ path: string[] }> },
) {
    return proxyRequest(request, await params);
}

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ path: string[] }> },
) {
    return proxyRequest(request, await params);
}

async function proxyRequest(request: NextRequest, params: { path: string[] }) {
    const { path } = params;
    const pathStr = path.join('/');
    const searchParams = request.nextUrl.searchParams.toString();
    const url = `${API_BASE_URL}/${pathStr}${searchParams ? `?${searchParams}` : ''}`;

    // Forward cookies from the request
    const cookieStore = await cookies();
    const cookieHeader = cookieStore
        .getAll()
        .map((cookie) => `${cookie.name}=${cookie.value}`)
        .join('; ');

    // Build headers for the proxied request
    const headers = new Headers();
    request.headers.forEach((value, key) => {
        // Skip host and connection headers
        if (!['host', 'connection'].includes(key.toLowerCase())) {
            headers.set(key, value);
        }
    });
    if (cookieHeader) {
        headers.set('cookie', cookieHeader);
    }

    // Get request body if present
    let body: string | undefined;
    if (request.method !== 'GET' && request.method !== 'HEAD') {
        try {
            body = await request.text();
        } catch {
            // Body might not be available or already consumed
        }
    }

    // Disable SSL verification in development for self-signed certificates
    const fetchOptions: RequestInit = {
        method: request.method,
        headers,
        body,
        redirect: 'manual',
    };

    // Make the proxied request
    const response = await fetch(url, fetchOptions);

    // Extract response body
    const responseBody = await response.arrayBuffer();

    // Forward response headers, excluding some that shouldn't be forwarded
    const responseHeaders = new Headers();
    response.headers.forEach((value, key) => {
        const lowerKey = key.toLowerCase();
        if (
            ![
                'connection',
                'keep-alive',
                'transfer-encoding',
                'content-encoding',
            ].includes(lowerKey)
        ) {
            responseHeaders.set(key, value);
        }
    });

    // Extract and set cookies from the API response
    const setCookieHeaders = response.headers.getSetCookie();
    for (const setCookieHeader of setCookieHeaders) {
        // Parse the set-cookie header
        const parts = setCookieHeader.split(';').map((part) => part.trim());
        const [nameValue] = parts;
        if (!nameValue) continue;

        // Split only on the first '=' since cookie values can contain '='
        const eqIndex = nameValue.indexOf('=');
        if (eqIndex === -1) continue;
        const name = nameValue.substring(0, eqIndex);
        const value = nameValue.substring(eqIndex + 1);
        if (!name) continue;

        // Parse cookie options
        const options: {
            httpOnly?: boolean;
            secure?: boolean;
            sameSite?: 'strict' | 'lax' | 'none';
            maxAge?: number;
            expires?: Date;
            path?: string;
        } = {};

        for (const part of parts.slice(1)) {
            // Split only on the first '=' since attribute values can contain '='
            const attrEqIndex = part.indexOf('=');
            const key =
                attrEqIndex === -1 ? part : part.substring(0, attrEqIndex);
            const val =
                attrEqIndex === -1
                    ? undefined
                    : part.substring(attrEqIndex + 1);
            if (!key) continue;

            const lowerKey = key.toLowerCase();
            if (lowerKey === 'httponly') {
                options.httpOnly = true;
            } else if (lowerKey === 'secure') {
                options.secure = true;
            } else if (lowerKey === 'samesite' && val) {
                options.sameSite = val.toLowerCase() as
                    | 'strict'
                    | 'lax'
                    | 'none';
            } else if (lowerKey === 'max-age' && val) {
                options.maxAge = Number.parseInt(val, 10);
            } else if (lowerKey === 'expires' && val) {
                options.expires = new Date(val);
            } else if (lowerKey === 'path' && val) {
                options.path = val;
            }
        }

        // Set the cookie
        cookieStore.set(name, value, options);
    }

    return new NextResponse(responseBody, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
    });
}
