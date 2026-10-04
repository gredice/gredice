import { createHash } from 'node:crypto';
import {
    redisCacheClient,
    redisCacheKeyForEnvironment,
} from '@gredice/storage';

const windowSeconds = 10 * 60;
const maximumRequestsPerWindow = 30;
let lastWarningAt = Number.NEGATIVE_INFINITY;

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

export function deliveryNativeAuthClientAddress(headers: Headers) {
    return (
        headerListValue(headers.get('x-vercel-forwarded-for'), 'first') ??
        headerListValue(headers.get('x-forwarded-for'), 'last') ??
        'unknown'
    );
}

export async function deliveryNativeAuthRateLimitAllows(input: {
    operation: 'exchange' | 'refresh';
    clientAddress: string;
}) {
    const client = redisCacheClient('gredice');
    if (!client) return !process.env.VERCEL_ENV;

    const addressHash = createHash('sha256')
        .update(input.clientAddress)
        .digest('hex')
        .slice(0, 24);
    const bucket = Math.floor(Date.now() / (windowSeconds * 1_000)).toString();
    const key = redisCacheKeyForEnvironment(
        `delivery-native-auth:rate:v1:${input.operation}:${addressHash}:${bucket}`,
    );

    try {
        const requestCount = await client.incr(key);
        await client.expire(key, windowSeconds + 1);
        return requestCount <= maximumRequestsPerWindow;
    } catch {
        if (Date.now() - lastWarningAt >= 60_000) {
            lastWarningAt = Date.now();
            console.warn('Delivery native auth rate limit unavailable', {
                errorCode: 'RATE_LIMIT_UNAVAILABLE',
            });
        }
        return false;
    }
}

export const deliveryNativeAuthRetryAfterSeconds = windowSeconds;
