import 'server-only';

import { randomUUID } from 'node:crypto';
import { headers } from 'next/headers';
import { cache } from 'react';

export function classifyAdminRequest(requestHeaders: Pick<Headers, 'get'>) {
    return {
        rsc: requestHeaders.get('rsc') === '1',
        routerPrefetch: requestHeaders.get('next-router-prefetch') === '1',
        segmentPrefetch:
            requestHeaders.get('next-router-segment-prefetch') !== null,
        browserPrefetch:
            requestHeaders.get('purpose') === 'prefetch' ||
            requestHeaders.get('sec-purpose')?.includes('prefetch') === true,
    };
}

const getRequestAttribution = cache(async () => ({
    requestId: randomUUID(),
    ...classifyAdminRequest(await headers()),
}));

export async function recordAdminRead(
    reader: string,
    durationMs: number,
    failed: boolean,
) {
    if (process.env.ADMIN_REQUEST_ATTRIBUTION !== '1') return;

    try {
        console.info(
            'admin-request-read',
            JSON.stringify({
                ...(await getRequestAttribution()),
                reader,
                durationMs: Math.round(durationMs),
                failed,
            }),
        );
    } catch {
        // Attribution must not change navigation or retry behavior.
    }
}
