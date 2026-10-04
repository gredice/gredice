import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { resolveStaticOpaqueSceneCacheBudget } from './staticOpaqueSceneCacheBudget';
import {
    resolveStaticOpaqueSceneCacheTarget,
    staticOpaqueSceneCacheMaximumBytes,
} from './staticOpaqueSceneCacheState';

const mebibyte = 1024 * 1024;

describe('static opaque scene cache budget', () => {
    it('scales with reported device memory up to the existing ceiling', () => {
        assert.deepEqual(
            resolveStaticOpaqueSceneCacheBudget({ deviceMemoryGiB: 8 }),
            {
                bytes: staticOpaqueSceneCacheMaximumBytes,
                deviceMemoryGiB: 8,
                source: 'device-memory',
            },
        );
        assert.equal(
            resolveStaticOpaqueSceneCacheBudget({ deviceMemoryGiB: 4 }).bytes,
            80 * mebibyte,
        );
        assert.equal(
            resolveStaticOpaqueSceneCacheBudget({ deviceMemoryGiB: 2 }).bytes,
            40 * mebibyte,
        );
        assert.equal(
            resolveStaticOpaqueSceneCacheBudget({ deviceMemoryGiB: 32 }).bytes,
            staticOpaqueSceneCacheMaximumBytes,
        );
    });

    it('disables the cache on low-memory devices', () => {
        assert.deepEqual(
            resolveStaticOpaqueSceneCacheBudget({ deviceMemoryGiB: 1 }),
            {
                bytes: 0,
                deviceMemoryGiB: 1,
                source: 'low-device-memory',
            },
        );
    });

    it('treats hidden device memory as a 4 GiB device', () => {
        for (const deviceMemoryGiB of [undefined, null, 0, Number.NaN]) {
            assert.deepEqual(
                resolveStaticOpaqueSceneCacheBudget({ deviceMemoryGiB }),
                {
                    bytes: 80 * mebibyte,
                    deviceMemoryGiB: null,
                    source: 'unknown-device-memory',
                },
            );
        }
    });

    it('rejects targets that exceed the device budget', () => {
        const lowBudget = resolveStaticOpaqueSceneCacheBudget({
            deviceMemoryGiB: 2,
        });
        assert.equal(
            resolveStaticOpaqueSceneCacheTarget({
                height: 1080,
                maximumBytes: lowBudget.bytes,
                width: 1920,
            }).reason,
            'target-budget',
        );
        assert.equal(
            resolveStaticOpaqueSceneCacheTarget({
                height: 720,
                maximumBytes: lowBudget.bytes,
                width: 1280,
            }).reason,
            'ready',
        );
        assert.equal(
            resolveStaticOpaqueSceneCacheTarget({
                height: 1080,
                maximumBytes: lowBudget.bytes,
                sampleCount: 0,
                width: 1920,
            }).reason,
            'ready',
        );
        assert.equal(
            resolveStaticOpaqueSceneCacheTarget({
                height: 0,
                maximumBytes: 0,
                width: 0,
            }).reason,
            'unsupported',
        );
    });
});
