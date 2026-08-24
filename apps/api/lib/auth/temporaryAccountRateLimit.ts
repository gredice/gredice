import { createHash } from 'node:crypto';
import {
    redisCacheClient,
    redisCacheKeyForEnvironment,
} from '@gredice/storage';

const rateLimitWindowSeconds = 10 * 60;
const maximumCreationsPerAddressPerWindow = 10;
let lastRateLimitWarningAt = Number.NEGATIVE_INFINITY;

function headerListValue(
    value: string | null | undefined,
    position: 'first' | 'last',
) {
    const values = value
        ?.split(',')
        .map((item) => item.trim())
        .filter(Boolean);
    return position === 'first' ? values?.[0] : values?.at(-1);
}

export function temporaryAccountClientAddress(headers: Headers) {
    return (
        headerListValue(headers.get('x-vercel-forwarded-for'), 'first') ??
        headerListValue(headers.get('x-forwarded-for'), 'last') ??
        'unknown'
    );
}

export async function temporaryAccountRateLimitAllows(clientAddress: string) {
    const client = redisCacheClient('gredice');
    if (!client) {
        return !process.env.VERCEL_ENV;
    }

    const addressHash = createHash('sha256')
        .update(clientAddress)
        .digest('hex')
        .slice(0, 24);
    const bucket = Math.floor(
        Date.now() / (rateLimitWindowSeconds * 1_000),
    ).toString();
    const key = redisCacheKeyForEnvironment(
        `temporary-accounts:rate:v1:${addressHash}:${bucket}`,
    );

    try {
        const requestCount = await client.incr(key);
        await client.expire(key, rateLimitWindowSeconds + 1);
        return requestCount <= maximumCreationsPerAddressPerWindow;
    } catch (error) {
        if (Date.now() - lastRateLimitWarningAt >= 60_000) {
            lastRateLimitWarningAt = Date.now();
            console.warn('Unable to rate limit temporary account creation', {
                error,
            });
        }
        return false;
    }
}

export const temporaryAccountRateLimitRetryAfterSeconds =
    rateLimitWindowSeconds;
