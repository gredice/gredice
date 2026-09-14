import { publishPublicPriceList } from '@gredice/storage';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const secret = process.env.CRON_SECRET;
    if (
        !secret ||
        request.headers.get('authorization') !== `Bearer ${secret}`
    ) {
        return new Response('Unauthorized', { status: 401 });
    }
    try {
        const snapshot = await publishPublicPriceList();
        return Response.json({
            id: snapshot.id,
            publishedAt: snapshot.createdAt,
        });
    } catch (error) {
        console.error('Failed to publish public price list', { error });
        return Response.json(
            { error: 'Price list publication failed' },
            { status: 500 },
        );
    }
}
