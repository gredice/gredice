import assert from 'node:assert/strict';
import { createServer, type Socket } from 'node:net';
import { performance } from 'node:perf_hooks';
import { describe, it } from 'node:test';
import {
    createGardenBlockBatchRateLimiter,
    type GardenBlockBatchRateLimitClient,
    gardenBlockBatchRateLimit,
    gardenBlockBatchRateLimitMaxRequests,
    gardenBlockBatchRateLimitTimeoutMs,
    gardenBlockBatchRateLimitWindowSeconds,
} from './gardenBlockBatchRateLimit';

function never<T>() {
    return new Promise<T>(() => undefined);
}

function fakeRedis() {
    const counts = new Map<string, number>();
    const expirations: { key: string; seconds: number }[] = [];
    const client: GardenBlockBatchRateLimitClient = {
        incr: async (key) => {
            const next = (counts.get(key) ?? 0) + 1;
            counts.set(key, next);
            return next;
        },
        expire: async (key, seconds) => {
            expirations.push({ key, seconds });
            return 1;
        },
    };
    return { client, counts, expirations };
}

describe('gardenBlockBatchRateLimit', () => {
    it('allows 30 batches per account in a 10 minute window and denies the 31st until the window ends', async () => {
        const redis = fakeRedis();
        const windowStart = 1_000 * gardenBlockBatchRateLimitWindowSeconds * 5;
        let now = windowStart + 4 * 60 * 1_000;
        const limiter = createGardenBlockBatchRateLimiter({
            getClient: () => redis.client,
            keyForEnvironment: (key) => `preview:${key}`,
            now: () => now,
            warn: () => assert.fail('No warning expected'),
        });

        for (
            let index = 0;
            index < gardenBlockBatchRateLimitMaxRequests;
            index++
        ) {
            assert.deepEqual(await limiter('account-1'), { allowed: true });
        }
        assert.deepEqual(await limiter('account-1'), {
            allowed: false,
            retryAfterSeconds: 6 * 60,
        });
        assert.deepEqual(await limiter('account-2'), { allowed: true });

        const [key] = [...redis.counts.keys()];
        assert.ok(key?.startsWith('preview:garden-block-batch:rate:v1:'));
        assert.ok(!key?.includes('account-1'));
        assert.equal(redis.counts.get(key ?? ''), 31);
        assert.ok(
            redis.expirations.every(
                (expiration) =>
                    expiration.seconds ===
                    gardenBlockBatchRateLimitWindowSeconds + 1,
            ),
        );

        now = windowStart + gardenBlockBatchRateLimitWindowSeconds * 1_000;
        assert.deepEqual(await limiter('account-1'), { allowed: true });
    });

    it('fails open without a Redis client and warns at most once a minute', async () => {
        let now = 0;
        const warnings: unknown[] = [];
        const limiter = createGardenBlockBatchRateLimiter({
            getClient: () => null,
            keyForEnvironment: (key) => key,
            now: () => now,
            warn: (message, context) => warnings.push({ message, context }),
        });

        assert.deepEqual(await limiter('account-1'), { allowed: true });
        now += 30_000;
        assert.deepEqual(await limiter('account-1'), { allowed: true });
        assert.equal(warnings.length, 1);
        now += 31_000;
        assert.deepEqual(await limiter('account-1'), { allowed: true });
        assert.equal(warnings.length, 2);
        assert.deepEqual(warnings[0], {
            message: 'Garden block batch rate limit unavailable',
            context: {
                errorCode: 'RATE_LIMIT_UNAVAILABLE',
                errorName: undefined,
                reason: 'missing-client',
            },
        });
    });

    it('fails open on Redis errors with a throttled warning that carries no account data', async () => {
        let now = 1_000_000;
        const warnings: { message: string; context: unknown }[] = [];
        const limiter = createGardenBlockBatchRateLimiter({
            getClient: () => ({
                incr: async () => {
                    throw new TypeError('connection reset for account-1');
                },
                expire: async () => 1,
            }),
            keyForEnvironment: (key) => key,
            now: () => now,
            warn: (message, context) => warnings.push({ message, context }),
        });

        for (let index = 0; index < 40; index++) {
            assert.deepEqual(await limiter('account-1'), { allowed: true });
        }
        assert.equal(warnings.length, 1);
        assert.deepEqual(warnings[0]?.context, {
            errorCode: 'RATE_LIMIT_UNAVAILABLE',
            errorName: 'TypeError',
            reason: 'redis-error',
        });
        assert.ok(!JSON.stringify(warnings).includes('account-1'));
        now += 60_000;
        await limiter('account-1');
        assert.equal(warnings.length, 2);
    });

    it('fails open within the deadline when Redis never answers', async () => {
        const warnings: { message: string; context: unknown }[] = [];
        let expireCalls = 0;
        const limiter = createGardenBlockBatchRateLimiter({
            getClient: () => ({
                incr: () => never<number>(),
                expire: async () => {
                    expireCalls++;
                    return 1;
                },
            }),
            keyForEnvironment: (key) => key,
            now: () => 0,
            timeoutMs: 40,
            warn: (message, context) => warnings.push({ message, context }),
        });

        const startedAt = performance.now();
        assert.deepEqual(await limiter('account-1'), { allowed: true });
        const elapsedMs = performance.now() - startedAt;
        assert.ok(elapsedMs >= 30, `waited ${elapsedMs.toFixed(0)} ms`);
        assert.ok(elapsedMs < 1_000, `waited ${elapsedMs.toFixed(0)} ms`);
        assert.equal(expireCalls, 0);
        assert.deepEqual(warnings, [
            {
                message: 'Garden block batch rate limit unavailable',
                context: {
                    errorCode: 'RATE_LIMIT_UNAVAILABLE',
                    errorName: undefined,
                    reason: 'redis-timeout',
                },
            },
        ]);
    });

    it('applies one deadline to INCR and EXPIRE together', async () => {
        const warnings: unknown[] = [];
        const limiter = createGardenBlockBatchRateLimiter({
            getClient: () => ({
                incr: async () => gardenBlockBatchRateLimitMaxRequests + 1,
                expire: () => never<unknown>(),
            }),
            keyForEnvironment: (key) => key,
            now: () => 0,
            timeoutMs: 40,
            warn: (_message, context) => warnings.push(context),
        });

        const startedAt = performance.now();
        assert.deepEqual(await limiter('account-1'), { allowed: true });
        assert.ok(performance.now() - startedAt < 1_000);
        assert.equal(warnings.length, 1);
    });

    it('uses a client without retries that fails open promptly when Redis accepts but never answers', async (t) => {
        const sockets = new Set<Socket>();
        let connections = 0;
        const server = createServer((socket) => {
            connections++;
            sockets.add(socket);
            socket.on('error', () => undefined);
            socket.on('close', () => sockets.delete(socket));
            // Read and drop the request so a client abort closes the socket.
            socket.resume();
        });
        await new Promise<void>((resolve) =>
            server.listen(0, '127.0.0.1', resolve),
        );
        const address = server.address();
        assert.ok(address && typeof address === 'object');
        const previousUrl = process.env.GREDICE_SILO_KV_REST_API_URL;
        const previousToken = process.env.GREDICE_SILO_KV_REST_API_TOKEN;
        process.env.GREDICE_SILO_KV_REST_API_URL = `http://127.0.0.1:${address.port.toString()}`;
        process.env.GREDICE_SILO_KV_REST_API_TOKEN = 'disposable-test-only';
        const warn = t.mock.method(console, 'warn', () => undefined);
        t.after(async () => {
            if (previousUrl === undefined)
                delete process.env.GREDICE_SILO_KV_REST_API_URL;
            else process.env.GREDICE_SILO_KV_REST_API_URL = previousUrl;
            if (previousToken === undefined)
                delete process.env.GREDICE_SILO_KV_REST_API_TOKEN;
            else process.env.GREDICE_SILO_KV_REST_API_TOKEN = previousToken;
            for (const socket of sockets) socket.destroy();
            await new Promise<void>((resolve) => server.close(() => resolve()));
        });

        const startedAt = performance.now();
        assert.deepEqual(await gardenBlockBatchRateLimit('account-probe'), {
            allowed: true,
        });
        const elapsedMs = performance.now() - startedAt;
        assert.ok(
            elapsedMs < gardenBlockBatchRateLimitTimeoutMs + 1_000,
            `waited ${elapsedMs.toFixed(0)} ms`,
        );
        // Give a retrying client time to reconnect, then check it did not.
        await new Promise((resolve) => setTimeout(resolve, 400));
        assert.equal(connections, 1);
        assert.equal(sockets.size, 0, 'the stalled request was aborted');
        assert.equal(warn.mock.callCount(), 1);
        assert.equal(
            warn.mock.calls[0]?.arguments[0],
            'Garden block batch rate limit unavailable',
        );
    });
});
