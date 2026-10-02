import { timingSafeEqual } from 'node:crypto';
import {
    acknowledgeNewsRevalidations,
    isPublicNewsSlug,
    maxNewsRevalidationSlugs,
    readPendingNewsRevalidations,
} from '@gredice/storage/cmsNewsRevalidation';
import { revalidatePath, revalidateTag } from 'next/cache';
import { NEWS_PUBLISHED_TAG, newsArticleTag } from '../../../lib/newsCache';

export const maxDuration = 30;

function authorized(request: Request, secret: string | undefined) {
    const supplied = request.headers.get('authorization');
    if (!secret || !supplied) return false;
    const expectedBytes = Buffer.from(`Bearer ${secret}`);
    const suppliedBytes = Buffer.from(supplied);
    return (
        expectedBytes.length === suppliedBytes.length &&
        timingSafeEqual(expectedBytes, suppliedBytes)
    );
}

function result(body: unknown, status = 200) {
    return Response.json(body, {
        status,
        headers: { 'cache-control': 'no-store' },
    });
}

function invalidate(slugs: string[]) {
    // Expire immediately: stale-while-revalidate must not expose an unpublished page.
    revalidateTag(NEWS_PUBLISHED_TAG, { expire: 0 });
    revalidatePath('/');
    revalidatePath('/sto-je-novo');
    for (const slug of new Set(slugs)) {
        // Next invalidation uses the route path without the configured basePath.
        revalidateTag(newsArticleTag(slug), { expire: 0 });
        const route = `/${slug.slice('novosti/'.length)}`;
        revalidatePath(route);
        revalidatePath(`${route}/opengraph-image`);
    }
}

export async function POST(request: Request) {
    if (!authorized(request, process.env.GREDICE_NEWS_REVALIDATE_SECRET)) {
        return result({ error: 'Unauthorized' }, 401);
    }
    // Read at most 4 KiB, including chunked requests.
    const reader = request.body?.getReader();
    if (!reader) return result({ error: 'Invalid body' }, 400);
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 4096) {
            await reader.cancel();
            return result({ error: 'Body too large' }, 413);
        }
        chunks.push(value);
    }
    let body: unknown;
    try {
        body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    } catch {
        return result({ error: 'Invalid body' }, 400);
    }
    if (
        !body ||
        typeof body !== 'object' ||
        !('slugs' in body) ||
        !Array.isArray(body.slugs) ||
        !body.slugs.length ||
        body.slugs.length > maxNewsRevalidationSlugs ||
        !body.slugs.every(isPublicNewsSlug)
    ) {
        return result({ error: 'Invalid slugs' }, 400);
    }
    invalidate(body.slugs);
    return result({ revalidated: true, slugs: new Set(body.slugs).size });
}

export async function GET(request: Request) {
    if (!authorized(request, process.env.CRON_SECRET))
        return result({ error: 'Unauthorized' }, 401);
    try {
        // Empty retries use Redis only: no CMS/database reads or cache invalidation.
        const entries = await readPendingNewsRevalidations();
        if (!entries.length) return result({ revalidated: false, pending: 0 });
        invalidate(entries.map(({ slug }) => slug));
        await acknowledgeNewsRevalidations(entries);
        return result({ revalidated: true, pending: entries.length });
    } catch {
        console.error('News revalidation retry failed; pending work retained.');
        return result({ error: 'Retry unavailable' }, 503);
    }
}
