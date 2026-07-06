import { type NextRequest, NextResponse } from 'next/server';
import {
    getDeploymentStats,
    getDeploymentStatsPeriodFromSearchParams,
} from '../deploymentStats';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    const period = getDeploymentStatsPeriodFromSearchParams(
        request.nextUrl.searchParams,
    );
    const snapshot = await getDeploymentStats(period);

    return NextResponse.json(snapshot, {
        headers: {
            'Cache-Control': 'private, no-store',
        },
    });
}
