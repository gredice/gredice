import { archivePastSlots } from '@gredice/storage';
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
        const archivedCount = await archivePastSlots();

        console.info(`Archived ${archivedCount} past time slots`);

        return Response.json({
            success: true,
            archivedSlotsCount: archivedCount,
            timestamp: new Date().toISOString(),
        });
    } catch (error) {
        console.error('Failed to archive past slots:', error);
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
