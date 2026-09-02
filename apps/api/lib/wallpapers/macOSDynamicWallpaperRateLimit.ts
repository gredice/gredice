import {
    redisCacheClient,
    redisCacheKeyForEnvironment,
} from '@gredice/storage';

const rateLimitWindowSeconds = 10 * 60;
const maximumConversionsPerWindow = 4;
let lastRateLimitWarningAt = Number.NEGATIVE_INFINITY;

export async function macOSDynamicWallpaperRateLimitAllows(accountId: string) {
    const client = redisCacheClient('gredice');
    if (!client) {
        return !process.env.VERCEL_ENV;
    }

    const bucket = Math.floor(
        Date.now() / (rateLimitWindowSeconds * 1_000),
    ).toString();
    const key = redisCacheKeyForEnvironment(
        `wallpapers:macos-dynamic:rate:v1:${accountId}:${bucket}`,
    );

    try {
        const requestCount = await client.incr(key);
        await client.expire(key, rateLimitWindowSeconds + 1);
        return requestCount <= maximumConversionsPerWindow;
    } catch (error) {
        if (Date.now() - lastRateLimitWarningAt >= 60_000) {
            lastRateLimitWarningAt = Date.now();
            console.warn('Unable to rate limit macOS wallpaper conversion', {
                error,
            });
        }
        return false;
    }
}

export const macOSDynamicWallpaperRateLimitRetryAfterSeconds =
    rateLimitWindowSeconds;
