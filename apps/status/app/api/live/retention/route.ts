import { pruneSystemActivity } from '../../../../lib/live/storeSystemActivity';

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
        const result = await pruneSystemActivity();
        return result
            ? Response.json(result, { headers })
            : new Response('Source unavailable', { status: 503, headers });
    } catch {
        console.error('Unable to prune status activity history.');
        return new Response('Unable to prune activity', {
            status: 503,
            headers,
        });
    }
}
