import { runAutomations } from '@gredice/storage';
import type { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

const EVENT_BATCH_LIMIT = 500;
const RUN_BATCH_LIMIT = 25;

export async function GET(request: NextRequest) {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return new Response('Unauthorized', {
            status: 401,
        });
    }

    const startedAt = Date.now();

    try {
        const result = await runAutomations({
            eventBatchLimit: EVENT_BATCH_LIMIT,
            runBatchLimit: RUN_BATCH_LIMIT,
            lockedBy: 'api-cron-automations',
        });

        return Response.json({
            success: true,
            ...result,
            durationMs: Date.now() - startedAt,
            timestamp: new Date().toISOString(),
        });
    } catch (error) {
        console.error('Failed to run automations:', error);
        return Response.json(
            {
                success: false,
                error:
                    error instanceof Error
                        ? error.message
                        : 'Unknown automation runner error',
                durationMs: Date.now() - startedAt,
                timestamp: new Date().toISOString(),
            },
            { status: 500 },
        );
    }
}
