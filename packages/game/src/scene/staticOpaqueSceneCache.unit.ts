import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    createStaticOpaqueSceneCacheRuntime,
    estimateStaticOpaqueSceneCacheBytes,
    isStaticOpaqueSceneCacheMaterialEligible,
    resolveStaticOpaqueSceneCacheTarget,
    transitionStaticOpaqueSceneCache,
} from './staticOpaqueSceneCacheState';

describe('static opaque scene cache material eligibility', () => {
    const opaqueMaterial = {
        alphaToCoverage: false,
        colorWrite: true,
        depthTest: true,
        depthWrite: true,
        opacity: 1,
        stencilWrite: false,
        transparent: false,
    };

    it('accepts only ordinary opaque color and depth writers', () => {
        assert.equal(
            isStaticOpaqueSceneCacheMaterialEligible(opaqueMaterial),
            true,
        );
        for (const material of [
            { ...opaqueMaterial, alphaToCoverage: true },
            { ...opaqueMaterial, colorWrite: false },
            { ...opaqueMaterial, depthTest: false },
            { ...opaqueMaterial, depthWrite: false },
            { ...opaqueMaterial, opacity: 0.9 },
            { ...opaqueMaterial, stencilWrite: true },
            { ...opaqueMaterial, transmission: 0.1 },
            { ...opaqueMaterial, transparent: true },
        ]) {
            assert.equal(
                isStaticOpaqueSceneCacheMaterialEligible(material),
                false,
            );
        }
    });
});

describe('static opaque scene cache target', () => {
    it('accounts for resolved and four-sample cache attachments', () => {
        assert.equal(
            estimateStaticOpaqueSceneCacheBytes(2560, 1440),
            162_201_600,
        );
        assert.deepEqual(
            resolveStaticOpaqueSceneCacheTarget({
                height: 1440,
                sampleCount: 4,
                width: 2560,
            }),
            {
                estimatedBytes: 162_201_600,
                height: 1440,
                reason: 'ready',
                supported: true,
                width: 2560,
            },
        );
        assert.equal(
            resolveStaticOpaqueSceneCacheTarget({
                height: 1440,
                sampleCount: 8,
                width: 2560,
            }).reason,
            'target-budget',
        );
    });

    it('rejects zero-sized and over-budget targets', () => {
        assert.equal(
            resolveStaticOpaqueSceneCacheTarget({
                height: 0,
                width: 2560,
            }).reason,
            'unsupported',
        );
        assert.equal(
            resolveStaticOpaqueSceneCacheTarget({
                height: 2160,
                width: 3840,
            }).reason,
            'target-budget',
        );
        assert.equal(
            resolveStaticOpaqueSceneCacheTarget({
                additionalBytes: 6 * 1024 * 1024,
                height: 1440,
                width: 2560,
            }).reason,
            'target-budget',
        );
    });
});

describe('static opaque scene cache transitions', () => {
    const enabledInput = {
        enabled: true,
        signature: 'camera-a',
        signatureChangeReason: 'camera-change' as const,
        supported: true,
    };

    it('warms a stable frame before capture and then serves hits', () => {
        const initial = transitionStaticOpaqueSceneCache(
            createStaticOpaqueSceneCacheRuntime(),
            enabledInput,
        );
        assert.equal(initial.action, 'live');
        assert.equal(initial.state, 'cold');

        const warm = transitionStaticOpaqueSceneCache(
            initial.runtime,
            enabledInput,
        );
        assert.equal(warm.action, 'live');

        const capture = transitionStaticOpaqueSceneCache(
            warm.runtime,
            enabledInput,
        );
        assert.equal(capture.action, 'capture');

        const hit = transitionStaticOpaqueSceneCache(
            capture.runtime,
            enabledInput,
        );
        assert.equal(hit.action, 'hit');
        assert.equal(hit.state, 'ready');
    });

    it('invalidates on signature changes and bypasses active interaction', () => {
        const ready = {
            cacheValid: true,
            lastSignature: 'camera-a',
            stableFrameCount: 1,
        };
        const changed = transitionStaticOpaqueSceneCache(ready, {
            ...enabledInput,
            signature: 'camera-b',
        });
        assert.equal(changed.invalidated, true);
        assert.equal(changed.reason, 'camera-change');
        assert.equal(changed.action, 'live');

        const interaction = transitionStaticOpaqueSceneCache(ready, {
            ...enabledInput,
            bypassReason: 'interaction',
        });
        assert.equal(interaction.action, 'live');
        assert.equal(interaction.state, 'bypass');
        assert.equal(interaction.runtime.cacheValid, false);
    });

    it('allows capture immediately after a live shadow refresh', () => {
        const ready = {
            cacheValid: true,
            lastSignature: 'camera-a',
            stableFrameCount: 1,
        };
        const shadow = transitionStaticOpaqueSceneCache(ready, {
            ...enabledInput,
            bypassReason: 'shadow-update',
        });
        assert.equal(shadow.action, 'live');

        const capture = transitionStaticOpaqueSceneCache(
            shadow.runtime,
            enabledInput,
        );
        assert.equal(capture.action, 'capture');
    });

    it('reports disabled and unsupported modes without stale validity', () => {
        const ready = {
            cacheValid: true,
            lastSignature: 'camera-a',
            stableFrameCount: 1,
        };
        assert.equal(
            transitionStaticOpaqueSceneCache(ready, {
                ...enabledInput,
                enabled: false,
            }).state,
            'disabled',
        );
        assert.equal(
            transitionStaticOpaqueSceneCache(ready, {
                ...enabledInput,
                supported: false,
            }).state,
            'unsupported',
        );
    });
});
