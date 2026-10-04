import { NextResponse } from 'next/server';
import { getLiveActivitySnapshot } from '../../../lib/live/getLiveActivitySnapshot';

export const dynamic = 'force-dynamic';

export async function GET() {
    const snapshot = await getLiveActivitySnapshot();

    return NextResponse.json(snapshot, {
        headers: {
            'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=30',
        },
    });
}
