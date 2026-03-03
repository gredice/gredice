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

    if (
        secFetchSite &&
        secFetchSite !== 'same-origin' &&
        secFetchSite !== 'same-site'
    ) {
        return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
    }

    const origin = headerStore.get('origin');
    if (origin) {
        if (origin === 'null') {
            return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
        }

        let originUrl: URL;
        try {
            originUrl = new URL(origin);
        } catch {
            return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
        }

        const requestUrl = new URL(request.url);
        if (originUrl.origin !== requestUrl.origin) {
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

    const body: TrackingRequestBody = {
        eventName: rawBody.eventName,
        eventId:
            'eventId' in rawBody && typeof rawBody.eventId === 'string'
                ? rawBody.eventId
                : undefined,
        eventSourceUrl:
            'eventSourceUrl' in rawBody &&
            typeof rawBody.eventSourceUrl === 'string'
                ? rawBody.eventSourceUrl
                : undefined,
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
