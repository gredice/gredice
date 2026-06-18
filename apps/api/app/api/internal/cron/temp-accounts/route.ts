import { cleanupInactiveTemporaryAccounts } from '@gredice/storage';
import type { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return new Response('Unauthorized', {
            status: 401,
        });
    }

    try {
        const cleanup = await cleanupInactiveTemporaryAccounts();

        return Response.json({
            success: true,
            checkedUsers: cleanup.checkedUsers,
            deletedAccounts: cleanup.deletedAccounts,
            deletedUsers: cleanup.deletedUsers,
            failedUserIds: cleanup.failedUserIds,
            cutoff: cleanup.cutoff.toISOString(),
            timestamp: new Date().toISOString(),
        });
    } catch (error) {
        console.error('Failed to clean up temporary accounts', { error });
        return Response.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                timestamp: new Date().toISOString(),
            },
            { status: 500 },
        );
    }
}
