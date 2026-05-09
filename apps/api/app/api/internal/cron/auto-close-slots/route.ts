import { autoCloseUpcomingSlots } from '@gredice/storage';
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
        await autoCloseUpcomingSlots();

        console.info(
            'Auto-closed upcoming time slots within the 48-hour window',
        );

        return Response.json({
            success: true,
            message: 'Auto-closed upcoming slots within 48-hour window',
            timestamp: new Date().toISOString(),
        });
    } catch (error) {
        console.error('Failed to auto-close upcoming slots:', error);
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
