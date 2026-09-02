import {
    redisCacheClient,
    redisCacheKeyForEnvironment,
} from '@gredice/storage';

const rateLimitWindowSeconds = 10 * 60;
const maximumConversionsPerWindow = 4;
const maximumUploadTokensPerWindow = 24;
let lastRateLimitWarningAt = Number.NEGATIVE_INFINITY;

async function rateLimitAllows({
    accountId,
    maximumRequests,
    scope,
}: {
    accountId: string;
    maximumRequests: number;
    scope: string;
}) {
    const client = redisCacheClient('gredice');
    if (!client) {
        return !process.env.VERCEL_ENV;
    }

    const bucket = Math.floor(
        Date.now() / (rateLimitWindowSeconds * 1_000),
    ).toString();
    const key = redisCacheKeyForEnvironment(
        `wallpapers:macos-dynamic:rate:v1:${scope}:${accountId}:${bucket}`,
    );

    try {
        const requestCount = await client.incr(key);
        await client.expire(key, rateLimitWindowSeconds + 1);
        return requestCount <= maximumRequests;
    } catch (error) {
        if (Date.now() - lastRateLimitWarningAt >= 60_000) {
            lastRateLimitWarningAt = Date.now();
            console.warn('Unable to rate limit macOS wallpaper request', {
                error,
            });
        }
        return false;
    }
}

export function macOSDynamicWallpaperRateLimitAllows(accountId: string) {
    return rateLimitAllows({
        accountId,
        maximumRequests: maximumConversionsPerWindow,
        scope: 'conversion',
    });
}

export function macOSDynamicWallpaperUploadRateLimitAllows(accountId: string) {
    return rateLimitAllows({
        accountId,
        maximumRequests: maximumUploadTokensPerWindow,
        scope: 'upload',
    });
}

export const macOSDynamicWallpaperRateLimitRetryAfterSeconds =
    rateLimitWindowSeconds;
