import type { NextRequest } from 'next/server';
import { drainHourlyQueue } from '../../../../../lib/cron/drainHourlyQueue';
import { sendQueuedWebPushAttempts } from '../../../../../lib/notifications/webPushSender';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const MAX_ATTEMPTS_PER_RUN = 100;

export async function GET(request: NextRequest) {
    const authHeader = request.headers.get('authorization');
    const secret = process.env.CRON_SECRET?.trim();
    if (!secret || authHeader !== `Bearer ${secret}`) {
        return new Response('Unauthorized', {
            status: 401,
        });
    }

    const drained = await drainHourlyQueue({
        runBatch: () =>
            sendQueuedWebPushAttempts({ limit: MAX_ATTEMPTS_PER_RUN }),
        // Stop on deferred/provider retries instead of immediately resubmitting them.
        shouldContinue: (batch) =>
            batch.configured &&
            batch.candidates === MAX_ATTEMPTS_PER_RUN &&
            batch.retried === 0 &&
            batch.accepted + batch.failed > 0,
    });
    const result = drained.results.reduce(
        (total, batch) => ({
            accepted: total.accepted + batch.accepted,
            candidates: total.candidates + batch.candidates,
            configured: total.configured && batch.configured,
            failed: total.failed + batch.failed,
            invalidated: total.invalidated + batch.invalidated,
            retried: total.retried + batch.retried,
            skipped: total.skipped + batch.skipped,
        }),
        {
            accepted: 0,
            candidates: 0,
            configured: true,
            failed: 0,
            invalidated: 0,
            retried: 0,
            skipped: 0,
        },
    );
    return Response.json(
        {
            success: !drained.capacityReached,
            capacityReached: drained.capacityReached,
            ...result,
        },
        { status: drained.capacityReached ? 503 : 200 },
    );
}
