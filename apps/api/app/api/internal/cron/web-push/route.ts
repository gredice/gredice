import type { NextRequest } from 'next/server';
import { sendQueuedWebPushAttempts } from '../../../../../lib/notifications/webPushSender';

export const dynamic = 'force-dynamic';

const MAX_ATTEMPTS_PER_RUN = 100;

export async function GET(request: NextRequest) {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return new Response('Unauthorized', {
            status: 401,
        });
    }

    const result = await sendQueuedWebPushAttempts({
        limit: MAX_ATTEMPTS_PER_RUN,
    });

    return Response.json({
        success: true,
        ...result,
    });
}
