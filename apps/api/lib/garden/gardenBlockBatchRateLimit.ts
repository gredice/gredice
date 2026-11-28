import { createHash } from 'node:crypto';
import {
    redisCacheKeyForEnvironment,
    redisFailFastClient,
} from '@gredice/storage';

/** Expand batches per account per fixed window (OPEN-8 default). */
export const gardenBlockBatchRateLimitMaxRequests = 30;
export const gardenBlockBatchRateLimitWindowSeconds = 10 * 60;
/**
 * Longest the limiter waits for Redis (INCR and EXPIRE together) before it
 * fails open, so an outage cannot stall the purchase it guards.
 */
export const gardenBlockBatchRateLimitTimeoutMs = 500;
const warningIntervalMs = 60_000;
const rateLimitTimedOut = Symbol('garden-block-batch-rate-limit-timeout');

export type GardenBlockBatchRateLimitClient = Readonly<{
    incr: (key: string) => Promise<number>;
    expire: (key: string, seconds: number) => Promise<unknown>;
}>;

export type GardenBlockBatchRateLimitDecision =
    | Readonly<{ allowed: true }>
    | Readonly<{ allowed: false; retryAfterSeconds: number }>;

export type GardenBlockBatchRateLimitDependencies = Readonly<{
    getClient: () => GardenBlockBatchRateLimitClient | null;
    keyForEnvironment: (key: string) => string;
    maxRequests?: number;
    now: () => number;
    /** Deadline for the Redis calls; defaults to 500 ms. */
    timeoutMs?: number;
    warn: (message: string, context: Readonly<Record<string, unknown>>) => void;
    windowSeconds?: number;
}>;

async function withDeadline<T>(operation: Promise<T>, timeoutMs: number) {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<typeof rateLimitTimedOut>((resolve) => {
        timer = setTimeout(() => resolve(rateLimitTimedOut), timeoutMs);
    });
    try {
        return await Promise.race([operation, deadline]);
    } finally {
        clearTimeout(timer);
    }
}

/**
 * Fixed-window limiter for `POST /api/gardens/:gardenId/blocks/batch`, keyed
 * by a hash of the account ID. It fails open: with no Redis client, a Redis
 * error, or no answer within `timeoutMs`, the request is allowed and a
 * warning is logged at most once a minute. Every other rule (ownership,
 * price, caps, balance) is still enforced by the purchase service, so an
 * outage only removes the request limit and adds at most `timeoutMs`.
 */
export function createGardenBlockBatchRateLimiter(
    dependencies: GardenBlockBatchRateLimitDependencies,
) {
    const maxRequests =
        dependencies.maxRequests ?? gardenBlockBatchRateLimitMaxRequests;
    const windowSeconds =
        dependencies.windowSeconds ?? gardenBlockBatchRateLimitWindowSeconds;
    const windowMs = windowSeconds * 1_000;
    const timeoutMs =
        dependencies.timeoutMs ?? gardenBlockBatchRateLimitTimeoutMs;
    let lastWarningAt = Number.NEGATIVE_INFINITY;

    function warnThrottled(reason: string, error?: unknown) {
        const now = dependencies.now();
        if (now - lastWarningAt < warningIntervalMs) {
            return;
        }
        lastWarningAt = now;
        dependencies.warn('Garden block batch rate limit unavailable', {
            errorCode: 'RATE_LIMIT_UNAVAILABLE',
            errorName: error instanceof Error ? error.name : undefined,
            reason,
        });
    }

    return async function gardenBlockBatchRateLimit(
        accountId: string,
    ): Promise<GardenBlockBatchRateLimitDecision> {
        const client = dependencies.getClient();
        if (!client) {
            warnThrottled('missing-client');
            return { allowed: true };
        }

        const now = dependencies.now();
        const bucket = Math.floor(now / windowMs);
        const accountHash = createHash('sha256')
            .update(accountId)
            .digest('hex')
            .slice(0, 24);
        const key = dependencies.keyForEnvironment(
            `garden-block-batch:rate:v1:${accountHash}:${bucket.toString()}`,
        );

        try {
            const requestCount = await withDeadline(
                (async () => {
                    const count = await client.incr(key);
                    await client.expire(key, windowSeconds + 1);
                    return count;
                })(),
                timeoutMs,
            );
            if (requestCount === rateLimitTimedOut) {
                warnThrottled('redis-timeout');
                return { allowed: true };
            }
            if (requestCount <= maxRequests) {
                return { allowed: true };
            }
            return {
                allowed: false,
                retryAfterSeconds: Math.max(
                    1,
                    Math.ceil(((bucket + 1) * windowMs - now) / 1_000),
                ),
            };
        } catch (error) {
            warnThrottled('redis-error', error);
            return { allowed: true };
        }
    };
}

export const gardenBlockBatchRateLimit = createGardenBlockBatchRateLimiter({
    // No retries and a per-command abort, so a Redis outage fails open
    // within the deadline instead of retrying in the background.
    getClient: () =>
        redisFailFastClient('gredice', {
            timeoutMs: gardenBlockBatchRateLimitTimeoutMs,
        }),
    keyForEnvironment: (key) => redisCacheKeyForEnvironment(key),
    now: () => Date.now(),
    warn: (message, context) => console.warn(message, context),
});
