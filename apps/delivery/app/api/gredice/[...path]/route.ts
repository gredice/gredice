import { getServerGrediceApiOrigin } from '@gredice/client';
import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';

type RouteContext = { params: Promise<{ path: string[] }> };

export async function GET(request: NextRequest, context: RouteContext) {
    return proxyRequest(request, (await context.params).path);
}

export async function POST(request: NextRequest, context: RouteContext) {
    return proxyRequest(request, (await context.params).path);
}

async function proxyRequest(request: NextRequest, path: string[]) {
    const url = new URL(`${getServerGrediceApiOrigin()}/${path.join('/')}`);
    url.search = request.nextUrl.search;

    const cookieStore = await cookies();
    const headers = new Headers(request.headers);
    headers.delete('host');
    headers.delete('connection');
    const cookieHeader = cookieStore
        .getAll()
        .map((cookie) => `${cookie.name}=${cookie.value}`)
        .join('; ');
    if (cookieHeader) headers.set('cookie', cookieHeader);

    const response = await fetch(url, {
        method: request.method,
        headers,
        body:
            request.method === 'GET' || request.method === 'HEAD'
                ? undefined
                : await request.text(),
        redirect: 'manual',
    });
    const responseHeaders = new Headers(response.headers);
    responseHeaders.delete('content-encoding');
    responseHeaders.delete('transfer-encoding');
    responseHeaders.delete('connection');

    return new NextResponse(await response.arrayBuffer(), {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
    });
}
