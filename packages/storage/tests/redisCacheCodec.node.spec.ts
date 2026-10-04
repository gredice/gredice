import assert from 'node:assert/strict';
import test from 'node:test';
import {
    decodeRedisCacheValue,
    encodeRedisCacheValue,
} from '../src/cache/redisCacheCodec';

test('Redis cache codec preserves small values and Dates in the plain envelope', () => {
    const createdAt = new Date('2026-08-14T10:00:00.000Z');
    const encoded = encodeRedisCacheValue(
        {
            createdAt,
            nested: [{ value: 'small' }],
        },
        { maxStoredBytes: 1024 },
    );

    assert.equal(encoded.encoding, 'plain');
    assert.ok(encoded.cacheValue);

    const decoded = decodeRedisCacheValue(encoded.cacheValue);
    assert.equal(decoded.hit, true);
    if (!decoded.hit) return;

    assert.deepEqual(decoded.value, {
        createdAt,
        nested: [{ value: 'small' }],
    });
});

test('Redis cache codec compresses large repetitive directory values', () => {
    const value = Array.from({ length: 10_000 }, (_, index) => ({
        id: index,
        information: {
            name: `Plant sort ${index}`,
            description:
                'Repeated directory metadata that compresses efficiently.',
        },
    }));
    const encoded = encodeRedisCacheValue(value, {
        maxStoredBytes: 512 * 1024,
    });

    assert.ok(encoded.sourceBytes > 512 * 1024);
    assert.equal(encoded.encoding, 'brotli');
    assert.ok(encoded.cacheValue);
    assert.ok((encoded.storedBytes ?? Number.POSITIVE_INFINITY) < 512 * 1024);

    const decoded = decodeRedisCacheValue(encoded.cacheValue);
    assert.equal(decoded.hit, true);
    if (!decoded.hit) return;

    assert.deepEqual(decoded.value, value);
});

test('Redis cache codec declines values above the uncompressed safety limit', () => {
    const encoded = encodeRedisCacheValue('x'.repeat(4096), {
        maxStoredBytes: 64,
        maxUncompressedBytes: 1024,
    });

    assert.equal(encoded.cacheValue, null);
    assert.equal(encoded.encoding, null);
    assert.ok(encoded.sourceBytes > 1024);
});

test('Redis cache codec rejects unknown envelopes', () => {
    assert.deepEqual(
        decodeRedisCacheValue({
            __grediceCacheEnvelope: 'unknown',
            value: 'ignored',
        }),
        { hit: false },
    );
});
