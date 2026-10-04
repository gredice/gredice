import { getPublishedPriceList } from '@gredice/storage';

export const dynamic = 'force-dynamic';

export async function GET() {
    const snapshot = await getPublishedPriceList();
    if (!snapshot)
        return new Response('Cjenik još nije objavljen.', { status: 503 });
    return new Response(snapshot.csv, {
        headers: {
            'content-type': 'text/csv; charset=utf-8',
            'content-disposition': `attachment; filename="${snapshot.filename}"`,
            'cache-control': 'no-store',
        },
    });
}
