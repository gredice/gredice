import type { NextRequest } from 'next/server';
import { drainHourlyQueue } from '../../../../../lib/cron/drainHourlyQueue';
import { handleDueWorkCron } from '../../../../../lib/cron/dueWork';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const DEFAULT_ADMIN_APP_URL = 'https://app.gredice.com';
const PROCESS_QUEUE_PATH = '/api/social-publishing/process-queue';

function getAdminAppUrl() {
    return (
        process.env.GREDICE_ADMIN_APP_URL?.trim() || DEFAULT_ADMIN_APP_URL
    ).replace(/\/$/, '');
}

export async function GET(request: NextRequest) {
    return handleDueWorkCron(
        request,
        'social-publishing',
        () => processDueQueue(request),
        { recoveryPreflight: true },
    );
}

async function processDueQueue(request: NextRequest) {
    const authHeader = request.headers.get('authorization');
    const secret = process.env.CRON_SECRET?.trim();
    if (!secret || authHeader !== `Bearer ${secret}`) {
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

    const drained = await drainHourlyQueue({
        runBatch: async () => {
            const response = await fetch(
                `${getAdminAppUrl()}${PROCESS_QUEUE_PATH}`,
                {
                    method: 'POST',
                    headers: { authorization: `Bearer ${queueSecret}` },
                    signal: AbortSignal.timeout(60_000),
                },
            );
            const body: unknown = await response.json().catch(() => null);
            const processed =
                typeof body === 'object' &&
                body !== null &&
                'processed' in body &&
                typeof body.processed === 'number'
                    ? body.processed
                    : 0;
            const failed =
                typeof body === 'object' &&
                body !== null &&
                'failed' in body &&
                typeof body.failed === 'number'
                    ? body.failed
                    : 0;
            return {
                ok: response.ok,
                status: response.status,
                body,
                processed,
                failed,
            };
        },
        shouldContinue: (batch) =>
            batch.ok && batch.processed === 20 && batch.failed === 0,
    });
    const healthy =
        !drained.capacityReached &&
        drained.results.every((batch) => batch.ok && batch.failed === 0);
    return Response.json(
        {
            success: healthy,
            capacityReached: drained.capacityReached,
            processed: drained.results.reduce(
                (total, batch) => total + batch.processed,
                0,
            ),
            failed: drained.results.reduce(
                (total, batch) => total + batch.failed,
                0,
            ),
            status: drained.results.at(-1)?.status,
            result: drained.results.at(-1)?.body,
        },
        { status: healthy ? 200 : 502 },
    );
}
