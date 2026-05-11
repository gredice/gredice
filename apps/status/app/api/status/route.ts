import { NextResponse } from 'next/server';
import { getStatusPageData } from '../../../lib/status/getStatusPageData';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
    const data = await getStatusPageData();

    return NextResponse.json(data, {
        headers: {
            'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
        },
    });
}
