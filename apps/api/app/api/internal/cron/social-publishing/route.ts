import type { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

const DEFAULT_ADMIN_APP_URL = 'https://app.gredice.com';
const PROCESS_QUEUE_PATH = '/api/social-publishing/process-queue';

function getAdminAppUrl() {
    return (
        process.env.GREDICE_ADMIN_APP_URL?.trim() || DEFAULT_ADMIN_APP_URL
    ).replace(/\/$/, '');
}

export async function GET(request: NextRequest) {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return new Response('Unauthorized', {
            status: 401,
        });
    }

    const queueSecret = process.env.SOCIAL_PUBLISHING_QUEUE_SECRET?.trim();
    if (!queueSecret) {
        return Response.json(
            { success: false, error: 'queue_secret_not_configured' },
            { status: 503 },
        );
    }

    const response = await fetch(`${getAdminAppUrl()}${PROCESS_QUEUE_PATH}`, {
        method: 'POST',
        headers: {
            authorization: `Bearer ${queueSecret}`,
        },
    });

    const body = await response.json().catch(() => null);

    return Response.json(
        {
            success: response.ok,
            status: response.status,
            result: body,
        },
        { status: response.ok ? 200 : 502 },
    );
}
