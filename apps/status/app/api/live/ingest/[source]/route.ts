import {
    parseGithubWebhook,
    parseVercelDrain,
    verifyWebhookSignature,
} from '../../../../../lib/live/ingestParsers';
import { storeSystemActivity } from '../../../../../lib/live/storeSystemActivity';

const MAX_BODY_BYTES = 10 * 1024 * 1024;

function noStoreResponse(body: string, status: number) {
    return new Response(body, {
        status,
        headers: { 'Cache-Control': 'private, no-store' },
    });
}

function isBodyTooLarge(request: Request) {
    const contentLength = request.headers.get('content-length');
    if (!contentLength) {
        return false;
    }

    const bytes = Number.parseInt(contentLength, 10);
    return Number.isFinite(bytes) && bytes > MAX_BODY_BYTES;
}

export async function POST(
    request: Request,
    context: { params: Promise<{ source: string }> },
) {
    const { source } = await context.params;
    if (source !== 'vercel' && source !== 'github') {
        return noStoreResponse('Not found', 404);
    }

    if (isBodyTooLarge(request)) {
        return noStoreResponse('Payload too large', 413);
    }

    const rawBody = await request.text();
    if (Buffer.byteLength(rawBody, 'utf8') > MAX_BODY_BYTES) {
        return noStoreResponse('Payload too large', 413);
    }

    try {
        if (source === 'vercel') {
            const secret = process.env.GREDICE_LIVE_VERCEL_DRAIN_SECRET?.trim();
            const signature = request.headers.get('x-vercel-signature');
            if (
                !secret ||
                !signature ||
                !verifyWebhookSignature(rawBody, signature, secret, 'sha1')
            ) {
                return noStoreResponse('Unauthorized', 401);
            }

            const events = parseVercelDrain(rawBody);
            const result = await storeSystemActivity(
                'vercel',
                signature,
                events,
            );
            return result === 'unavailable'
                ? noStoreResponse('Source unavailable', 503)
                : noStoreResponse('Accepted', 202);
        }

        const secret = process.env.GREDICE_LIVE_GITHUB_WEBHOOK_SECRET?.trim();
        const signature = request.headers.get('x-hub-signature-256');
        const delivery = request.headers.get('x-github-delivery');
        const eventName = request.headers.get('x-github-event');
        if (
            !secret ||
            !signature ||
            !delivery ||
            !eventName ||
            !verifyWebhookSignature(rawBody, signature, secret, 'sha256')
        ) {
            return noStoreResponse('Unauthorized', 401);
        }

        const events = parseGithubWebhook(eventName, rawBody);
        const result = await storeSystemActivity('github', delivery, events);
        return result === 'unavailable'
            ? noStoreResponse('Source unavailable', 503)
            : noStoreResponse('Accepted', 202);
    } catch (error) {
        console.error('Unable to ingest a live system activity delivery.', {
            errorName: error instanceof Error ? error.name : 'UnknownError',
            source,
        });
        return noStoreResponse('Unable to accept delivery', 503);
    }
}
