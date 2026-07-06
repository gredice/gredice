import { type NextRequest, NextResponse } from 'next/server';
import {
    DEPLOYMENT_STATS_CACHE_SECONDS,
    getDeploymentStats,
    getDeploymentStatsPeriodFromSearchParams,
} from '../deploymentStats';

export const dynamic = 'force-dynamic';

const cacheControl = `public, max-age=0, s-maxage=${DEPLOYMENT_STATS_CACHE_SECONDS}`;

export async function GET(request: NextRequest) {
    const period = getDeploymentStatsPeriodFromSearchParams(
        request.nextUrl.searchParams,
    );
    const snapshot = await getDeploymentStats(period);

    return NextResponse.json(snapshot, {
        headers: {
            'Cache-Control': cacheControl,
        },
    });
}
