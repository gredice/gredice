import { getPublishedPriceList } from '@gredice/storage';

export async function GET(
    _request: Request,
    { params }: { params: Promise<{ id: string }> },
) {
    const { id } = await params;
    if (!/^\d+$/.test(id) || !Number.isSafeInteger(Number(id)))
        return new Response('Not found', { status: 404 });
    const snapshot = await getPublishedPriceList(Number(id));
    if (!snapshot) return new Response('Not found', { status: 404 });
    return new Response(snapshot.csv, {
        headers: {
            'content-type': 'text/csv; charset=utf-8',
            'content-disposition': `attachment; filename="${snapshot.filename}"`,
            'cache-control': 'public, max-age=31536000, immutable',
        },
    });
}
