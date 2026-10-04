import { configuredActivityBuffer } from '../../../../lib/live/activityBuffer';
import { flushSystemActivity } from '../../../../lib/live/flushSystemActivity';

export const maxDuration = 60;

export async function GET(request: Request) {
    const secret = process.env.CRON_SECRET?.trim();
    const headers = { 'Cache-Control': 'private, no-store' };
    if (
        !secret ||
        request.headers.get('authorization') !== `Bearer ${secret}`
    ) {
        return new Response('Unauthorized', { status: 401, headers });
    }
    if (process.env.GREDICE_LIVE_INGEST_MODE?.trim() !== 'buffered') {
        return Response.json({ status: 'disabled' }, { headers });
    }
    try {
        const buffer = configuredActivityBuffer();
        if (!buffer)
            return new Response('Source unavailable', { status: 503, headers });
        return Response.json(await flushSystemActivity(buffer), { headers });
    } catch {
        console.error('Unable to flush status activity buffer.');
        return new Response('Unable to flush activity', {
            status: 503,
            headers,
        });
    }
}
