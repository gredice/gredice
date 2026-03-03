import { cookies, headers } from 'next/headers';
import { after, NextResponse } from 'next/server';
import { sendFacebookCapiEvent } from '../../../lib/facebook-capi';

type TrackingRequestBody = {
    eventId?: string;
    eventName: string;
    eventSourceUrl?: string;
};

function getIpAddress(forwardedForHeader: string | null) {
    if (!forwardedForHeader) {
        return undefined;
    }

    return forwardedForHeader.split(',')[0]?.trim();
}

export async function POST(request: Request) {
    // CSRF protection: validate Origin and Sec-Fetch-Site headers
    const headerStore = await headers();
    const secFetchSite = headerStore.get('sec-fetch-site');
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
        return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
    }

    const origin = headerStore.get('origin');
    if (origin) {
        if (origin === 'null') {
            console.error('CSRF check failed: forbidden null Origin header');
            return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
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
            return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
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
            return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
        }
    }

    let rawBody: unknown;
    try {
        rawBody = await request.json();
    } catch {
        return NextResponse.json({ error: 'Invalid body.' }, { status: 400 });
    }

    if (!rawBody || typeof rawBody !== 'object') {
        return NextResponse.json({ error: 'Invalid body.' }, { status: 400 });
    }

    if (
        !('eventName' in rawBody) ||
        typeof rawBody.eventName !== 'string' ||
        rawBody.eventName.length === 0
    ) {
        return NextResponse.json(
            { error: 'Missing eventName.' },
            { status: 400 },
        );
    }

    const allowedEventNames = ['PageView'];
    if (!allowedEventNames.includes(rawBody.eventName)) {
        return NextResponse.json(
            { error: 'Invalid eventName.' },
            { status: 400 },
        );
    }

    // Validate and normalize eventSourceUrl to avoid forwarding arbitrary URLs.
    let safeEventSourceUrl: string | undefined;
    if (
        'eventSourceUrl' in rawBody &&
        typeof rawBody.eventSourceUrl === 'string' &&
        rawBody.eventSourceUrl.length > 0 &&
        rawBody.eventSourceUrl.length <= 2048
    ) {
        try {
            const parsedEventSourceUrl = new URL(
                rawBody.eventSourceUrl,
                requestUrl.origin,
            );

            const isSameOrigin =
                parsedEventSourceUrl.origin === requestUrl.origin ||
                (isLocalhost(parsedEventSourceUrl.hostname) &&
                    isLocalhost(requestUrl.hostname) &&
                    parsedEventSourceUrl.port === requestUrl.port &&
                    parsedEventSourceUrl.protocol === requestUrl.protocol);

            if (isSameOrigin) {
                safeEventSourceUrl = parsedEventSourceUrl.toString();
            }
        } catch (error) {
            console.error(
                'Invalid eventSourceUrl in tracking request',
                rawBody.eventSourceUrl,
                error,
            );
            // Ignore invalid URLs and leave safeEventSourceUrl as undefined.
        }
    }

    const body: TrackingRequestBody = {
        eventName: rawBody.eventName,
        eventId:
            'eventId' in rawBody && typeof rawBody.eventId === 'string'
                ? rawBody.eventId
                : undefined,
        eventSourceUrl: safeEventSourceUrl,
    };

    const cookieStore = await cookies();

    after(async () => {
        await sendFacebookCapiEvent({
            event_name: body.eventName,
            event_id: body.eventId,
            event_source_url: body.eventSourceUrl,
            user_data: {
                client_ip_address: getIpAddress(
                    headerStore.get('x-forwarded-for'),
                ),
                client_user_agent: headerStore.get('user-agent') ?? undefined,
                fbc: cookieStore.get('_fbc')?.value,
                fbp: cookieStore.get('_fbp')?.value,
            },
        });
    });

    return NextResponse.json({ ok: true });
}

function isLocalhost(hostname: string): boolean {
    return (
        hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname === '[::1]'
    );
}
