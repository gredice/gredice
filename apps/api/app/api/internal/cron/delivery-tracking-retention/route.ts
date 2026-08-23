import {
    clearExpiredDeliveryRunLocations,
    pruneExpiredDeliveryRunHandoffOperations,
} from '@gredice/storage';
import type { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

const noStoreHeaders = { 'Cache-Control': 'private, no-store' };

function boundedErrorCode(error: unknown) {
    if (
        typeof error !== 'object' ||
        error === null ||
        !('code' in error) ||
        typeof error.code !== 'string'
    ) {
        return undefined;
    }

    return error.code.slice(0, 64);
}

export async function GET(request: NextRequest) {
    const cronSecret = process.env.CRON_SECRET?.trim();
    if (
        !cronSecret ||
        request.headers.get('authorization') !== `Bearer ${cronSecret}`
    ) {
        return new Response('Unauthorized', {
            status: 401,
            headers: noStoreHeaders,
        });
    }

    try {
        const cleared = await clearExpiredDeliveryRunLocations();
        const prunedHandoffOperationCount =
            await pruneExpiredDeliveryRunHandoffOperations();
        if (cleared.length > 0) {
            console.warn('Expired stale delivery tracking coordinates', {
                clearedCount: cleared.length,
            });
        }
        if (prunedHandoffOperationCount > 0) {
            console.warn('Pruned expired delivery handoff operations', {
                prunedCount: prunedHandoffOperationCount,
            });
        }
        return Response.json(
            {
                success: true,
                clearedCount: cleared.length,
                prunedHandoffOperationCount,
                timestamp: new Date().toISOString(),
            },
            { headers: noStoreHeaders },
        );
    } catch (error) {
        console.error('Failed delivery retention cleanup', {
            errorName: error instanceof Error ? error.name : 'Unknown',
            errorCode: boundedErrorCode(error),
        });
        return Response.json(
            {
                success: false,
                timestamp: new Date().toISOString(),
            },
            { status: 500, headers: noStoreHeaders },
        );
    }
}
