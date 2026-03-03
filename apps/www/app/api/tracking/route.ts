import { cookies, headers } from 'next/headers';
import { NextResponse } from 'next/server';
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
    const rawBody: unknown = await request.json();

    if (!rawBody || typeof rawBody !== 'object') {
        return NextResponse.json({ error: 'Invalid body.' }, { status: 400 });
    }

    if (
        !('eventName' in rawBody) ||
        typeof rawBody.eventName !== 'string' ||
        rawBody.eventName.length === 0
    ) {
        return NextResponse.json({ error: 'Missing eventName.' }, { status: 400 });
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

    const headerStore = await headers();
    const cookieStore = await cookies();

    await sendFacebookCapiEvent({
        event_name: body.eventName,
        event_id: body.eventId,
        event_source_url: body.eventSourceUrl,
        user_data: {
            client_ip_address: getIpAddress(headerStore.get('x-forwarded-for')),
            client_user_agent: headerStore.get('user-agent') ?? undefined,
            fbc: cookieStore.get('_fbc')?.value,
            fbp: cookieStore.get('_fbp')?.value,
        },
    });

    return NextResponse.json({ ok: true });
}
