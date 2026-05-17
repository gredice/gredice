import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';
import { KnownPages } from '../../../../src/KnownPages';
import { processReadySocialPosts } from '../../../../src/social/socialPublishingQueue';

const SOCIAL_QUEUE_BATCH_LIMIT = 20;

export async function GET(request: Request) {
    return processQueueRequest(request);
}

export async function POST(request: Request) {
    return processQueueRequest(request);
}

async function processQueueRequest(request: Request) {
    const secret = (
        process.env.SOCIAL_PUBLISHING_QUEUE_SECRET ?? process.env.CRON_SECRET
    )?.trim();
    if (!secret) {
        return NextResponse.json(
            { ok: false, error: 'queue_secret_not_configured' },
            { status: 503 },
        );
    }

    if (request.headers.get('authorization') !== `Bearer ${secret}`) {
        return NextResponse.json(
            { ok: false, error: 'unauthorized' },
            { status: 401 },
        );
    }

    const result = await processReadySocialPosts({
        limit: SOCIAL_QUEUE_BATCH_LIMIT,
    });
    revalidatePath(KnownPages.SocialPublishing);

    return NextResponse.json({
        ok: result.failed === 0,
        processed: result.processed,
        failed: result.failed,
    });
}
