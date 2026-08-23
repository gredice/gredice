import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import test from 'node:test';
import {
    cacheKeys,
    directoryCacheProjectPrefixesForInvalidation,
} from '../src/cache/directoriesCached';
import { entityReadModelInvalidationClosure } from '../src/cache/entityReadModelInvalidation';
import {
    redisCacheClient,
    redisCached,
    redisCacheKeyForEnvironment,
} from '../src/cache/redisCache';
import { createUpstashRedisRequester } from '../src/cache/upstashRedisRequester';

test('oversized directory payloads use rollout-safe cache keys', () => {
    assert.equal(
        cacheKeys.entityTypeName('plant'),
        'entities:formatted:plant:state:published:locale:default:v2',
    );
    assert.equal(
        cacheKeys.entityTypeName('plantSort'),
        'entities:formatted:plantSort:state:published:locale:default:v2',
    );
    assert.equal(
        cacheKeys.entityTypeName('seed'),
        'entities:formatted:seed:state:published:locale:default:v2',
    );
    assert.equal(
        cacheKeys.entityTypeName('operation'),
        'entities:formatted:operation:state:published:locale:default:v1',
    );
});

test('Redis cache keys isolate non-production environments', () => {
    assert.equal(
        redisCacheKeyForEnvironment('entities:formatted:plant', 'preview'),
        'preview:entities:formatted:plant',
    );
    assert.equal(
        redisCacheKeyForEnvironment('entities:formatted:plant', 'development'),
        'development:entities:formatted:plant',
    );
    assert.equal(
        redisCacheKeyForEnvironment('entities:formatted:plant', 'production'),
        'entities:formatted:plant',
    );
    assert.equal(
        redisCacheKeyForEnvironment('entities:formatted:plant', ''),
        'entities:formatted:plant',
    );
    assert.equal(
        redisCacheKeyForEnvironment(
            'entities:formatted:plant',
            'production',
            'news',
        ),
        'news:entities:formatted:plant',
    );
    assert.equal(
        redisCacheKeyForEnvironment(
            'entities:formatted:plant',
            'preview',
            'news:',
        ),
        'news:preview:entities:formatted:plant',
    );
});

test('production directory invalidation covers every project namespace', () => {
    assert.deepEqual(
        directoryCacheProjectPrefixesForInvalidation('production', 'news'),
        ['', 'news', 'delivery'],
    );
    assert.deepEqual(
        directoryCacheProjectPrefixesForInvalidation('preview', 'news'),
        ['news'],
    );
    assert.deepEqual(
        directoryCacheProjectPrefixesForInvalidation(
            'production',
            'future-project:',
        ),
        ['', 'news', 'delivery', 'future-project'],
    );
});

test('entity read-model invalidation follows references and derived aggregates', () => {
    const references = [
        { entityTypeName: 'plantSort', dataType: 'ref:plant' },
        { entityTypeName: 'seed', dataType: 'ref:brand' },
        { entityTypeName: 'seed', dataType: 'ref:plantSort' },
        { entityTypeName: 'cycleA', dataType: 'ref:cycleB' },
        { entityTypeName: 'cycleB', dataType: 'ref:cycleA' },
    ];

    assert.deepEqual(
        entityReadModelInvalidationClosure(['brand'], references),
        ['brand', 'seed'],
    );
    assert.deepEqual(
        entityReadModelInvalidationClosure(['plantStage'], references),
        ['plantStage', 'operation', 'plant', 'plantSort', 'seed'],
    );
    assert.deepEqual(
        entityReadModelInvalidationClosure(['cycleA'], references),
        ['cycleA', 'cycleB'],
    );
});

test('Redis cache coalesces concurrent loads without configured credentials', async () => {
    let calls = 0;
    let releaseLoader: (() => void) | undefined;
    const loaderGate = new Promise<void>((resolve) => {
        releaseLoader = resolve;
    });
    const loader = async () => {
        calls += 1;
        await loaderGate;
        return { value: 'loaded' };
    };

    const first = redisCached('test:coalesced', loader, {
        namespace: 'gredice',
    });
    const second = redisCached('test:coalesced', loader, {
        namespace: 'gredice',
    });
    releaseLoader?.();

    assert.deepEqual(await Promise.all([first, second]), [
        { value: 'loaded' },
        { value: 'loaded' },
    ]);
    assert.equal(calls, 1);
});

test('Redis cache fails before loading when required credentials are absent', async () => {
    let calls = 0;

    await assert.rejects(
        redisCached(
            'test:required',
            async () => {
                calls += 1;
                return { value: 'loaded' };
            },
            {
                namespace: 'gredice',
                required: true,
            },
        ),
        /Redis cache credentials are required/u,
    );
    assert.equal(calls, 0);
});

test('Redis REST transport bypasses global fetch during static rendering', async (t) => {
    const previousUrl = process.env.PLANTS_SILO_KV_REST_API_URL;
    const previousToken = process.env.PLANTS_SILO_KV_REST_API_TOKEN;
    const storedValues = new Map<string, unknown>();
    const requestPaths: string[] = [];
    const requestSyncTokens: Array<string | undefined> = [];
    let loaderCalls = 0;
    let malformedResponseRequests = 0;
    let nonSuccessRequests = 0;
    let retryRequests = 0;
    let serverError: unknown;
    let successfulResponses = 0;

    const server = createServer(async (request, response) => {
        try {
            assert.equal(request.method, 'POST');
            assert.equal(request.headers.authorization, 'Bearer test-token');
            requestPaths.push(request.url ?? '');
            const syncToken = request.headers['upstash-sync-token'];
            const normalizedSyncToken = Array.isArray(syncToken)
                ? syncToken[0]
                : syncToken;
            requestSyncTokens.push(normalizedSyncToken);

            if (request.url === '/retry') {
                retryRequests += 1;
                if (retryRequests === 1) {
                    request.socket.destroy();
                    return;
                }
                response.setHeader('upstash-sync-token', 'sync-retry');
                response.setHeader('content-type', 'application/json');
                response.end(JSON.stringify({ result: 'retried' }));
                return;
            }
            if (request.url === '/non-success') {
                nonSuccessRequests += 1;
                response.statusCode = 503;
                response.end(JSON.stringify({ error: 'unavailable' }));
                return;
            }
            if (request.url === '/malformed') {
                malformedResponseRequests += 1;
                response.end('not-json');
                return;
            }
            if (request.url === '/sync-token') {
                assert.equal(normalizedSyncToken, 'sync-retry');
                response.setHeader('content-type', 'application/json');
                response.end(JSON.stringify({ result: 'synchronized' }));
                return;
            }

            let rawBody = '';
            for await (const chunk of request) {
                rawBody += chunk;
            }
            const pipeline: unknown = JSON.parse(rawBody);
            assert.ok(Array.isArray(pipeline));

            if (typeof pipeline[0] === 'string') {
                assert.equal(pipeline[0].toLowerCase(), 'scan');
                assert.equal(normalizedSyncToken, 'sync-3');
                successfulResponses += 1;
                response.setHeader(
                    'upstash-sync-token',
                    `sync-${successfulResponses}`,
                );
                response.setHeader('content-type', 'application/json');
                response.end(
                    JSON.stringify({
                        result: ['0', [...storedValues.keys()]],
                    }),
                );
                return;
            }

            const results = pipeline.map((rawCommand) => {
                assert.ok(Array.isArray(rawCommand));
                const [rawName, rawKey, value] = rawCommand;
                assert.equal(typeof rawName, 'string');
                assert.equal(typeof rawKey, 'string');
                const name = rawName.toLowerCase();

                if (name === 'get') {
                    return { result: storedValues.get(rawKey) ?? null };
                }
                if (name === 'set') {
                    storedValues.set(rawKey, value);
                    return { result: 'OK' };
                }

                throw new Error(`Unexpected Redis command in test: ${name}`);
            });

            successfulResponses += 1;
            response.setHeader(
                'upstash-sync-token',
                `sync-${successfulResponses}`,
            );
            response.setHeader('content-type', 'application/json');
            response.end(JSON.stringify(results));
        } catch (error) {
            serverError = error;
            response.statusCode = 500;
            response.end('{}');
        }
    });

    await new Promise<void>((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', resolve);
    });
    const address = server.address();
    assert.ok(address && typeof address === 'object');

    process.env.PLANTS_SILO_KV_REST_API_URL = `http://127.0.0.1:${address.port}`;
    process.env.PLANTS_SILO_KV_REST_API_TOKEN = 'test-token';
    let globalFetchCalls = 0;
    t.mock.method(globalThis, 'fetch', async () => {
        globalFetchCalls += 1;
        throw new Error('global fetch must not be used by Redis');
    });
    t.after(async () => {
        await new Promise<void>((resolve) => server.close(() => resolve()));
        if (previousUrl === undefined) {
            delete process.env.PLANTS_SILO_KV_REST_API_URL;
        } else {
            process.env.PLANTS_SILO_KV_REST_API_URL = previousUrl;
        }
        if (previousToken === undefined) {
            delete process.env.PLANTS_SILO_KV_REST_API_TOKEN;
        } else {
            process.env.PLANTS_SILO_KV_REST_API_TOKEN = previousToken;
        }
    });

    const first = await redisCached(
        'test:static-rendering',
        async () => {
            loaderCalls += 1;
            return { value: 'loaded' };
        },
        { jitterRatio: 0, required: true },
    );
    const second = await redisCached(
        'test:static-rendering',
        async () => {
            loaderCalls += 1;
            return { value: 'unexpected' };
        },
        { jitterRatio: 0, required: true },
    );

    assert.deepEqual(first, { value: 'loaded' });
    assert.deepEqual(second, { value: 'loaded' });
    const client = redisCacheClient();
    assert.ok(client);
    assert.deepEqual(await client.scan('0'), ['0', ['test:static-rendering']]);
    assert.equal(loaderCalls, 1);
    assert.equal(globalFetchCalls, 0);
    assert.deepEqual(requestPaths, [
        '/pipeline',
        '/pipeline',
        '/pipeline',
        '/',
    ]);
    assert.deepEqual(requestSyncTokens, [
        undefined,
        'sync-1',
        'sync-2',
        'sync-3',
    ]);
    assert.equal(serverError, undefined);

    const requester = createUpstashRedisRequester({
        url: `http://127.0.0.1:${address.port}`,
        token: 'test-token',
        retry: { backoff: () => 0, retries: 1 },
    });
    assert.deepEqual(await requester.request<string>({ path: ['retry'] }), {
        result: 'retried',
    });
    assert.equal(retryRequests, 2);
    assert.deepEqual(
        await requester.request<string>({ path: ['sync-token'] }),
        { result: 'synchronized' },
    );
    await assert.rejects(
        requester.request({ path: ['non-success'] }),
        /failed with status 503/u,
    );
    assert.equal(nonSuccessRequests, 1);
    await assert.rejects(
        requester.request({ path: ['malformed'] }),
        /response was not valid JSON/u,
    );
    assert.equal(malformedResponseRequests, 1);
    assert.equal(globalFetchCalls, 0);
    assert.equal(serverError, undefined);
});
