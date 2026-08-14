import assert from 'node:assert/strict';
import test from 'node:test';
import {
    cacheKeys,
    directoryCacheProjectPrefixesForInvalidation,
} from '../src/cache/directoriesCached';
import { entityReadModelInvalidationClosure } from '../src/cache/entityReadModelInvalidation';
import {
    redisCached,
    redisCacheKeyForEnvironment,
} from '../src/cache/redisCache';

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
