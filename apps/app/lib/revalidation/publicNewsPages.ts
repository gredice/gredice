import 'server-only';
import {
    enqueueNewsRevalidation,
    publicNewsSlugs,
} from '@gredice/storage/cmsNewsRevalidation';

export async function revalidatePublicNewsPages(slugs: Iterable<unknown>) {
    const newsSlugs = publicNewsSlugs(slugs);
    if (!newsSlugs.length) return;
    const isProduction =
        process.env.VERCEL_ENV === 'production' ||
        process.env.NEXT_PUBLIC_VERCEL_ENV === 'production';
    const origin =
        process.env.GREDICE_NEWS_REVALIDATE_URL?.trim() ||
        (isProduction ? 'https://novosti.gredice.com' : null);
    if (!origin) return;
    const secret = process.env.GREDICE_NEWS_REVALIDATE_SECRET;
    try {
        if (!secret) throw new Error('News revalidation secret unavailable.');
        const response = await fetch(
            new URL('/novosti/api/revalidate', origin),
            {
                method: 'POST',
                headers: {
                    authorization: `Bearer ${secret}`,
                    'content-type': 'application/json',
                },
                body: JSON.stringify({ slugs: newsSlugs }),
                cache: 'no-store',
                signal: AbortSignal.timeout(5000),
            },
        );
        if (response.ok) return;
    } catch {
        // The CMS mutation is already durable. Do not misreport its saved state.
    }
    try {
        await enqueueNewsRevalidation(newsSlugs);
        console.warn('News revalidation deferred to the hourly retry.');
    } catch {
        console.error(
            'News revalidation request and durable retry admission failed; TTL fallback remains.',
        );
    }
}
