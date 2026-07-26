import assert from 'node:assert/strict';
import test from 'node:test';
import {
    generatedPlantTemplateVariantCount,
    getGeneratedPlantInstanceVariation,
    getGeneratedPlantTemplateKey,
    getGeneratedPlantTemplateSeed,
    resolveGeneratedPlantTemplateVariant,
} from '../lib/generatedPlantTemplates';
import {
    PACKED_PLANT_RENDER_DATA_VERSION,
    type PackedPlantRenderData,
} from '../lib/packedPlantRenderData';
import { plantTypes } from '../lib/plant-definitions';
import {
    GeneratedPlantTemplateCache,
    getGeneratedPlantTemplateCacheDelta,
} from './generatedPlantTemplateCache';

function packedFloatValues(count: number): PackedPlantRenderData {
    return {
        bounds: {
            boxMax: [1, 1, 1],
            boxMin: [-1, 0, -1],
            sphereCenter: [0, 0.5, 0],
            sphereRadius: 1.5,
        },
        flowers: {
            count: 0,
            matrices: new Float32Array(),
            swayPhases: new Float32Array(),
        },
        leaves: {
            colors: new Float32Array(),
            count: 0,
            matrices: new Float32Array(),
            swayPhases: new Float32Array(),
        },
        lodSummary: {
            accentCenterY: 0,
            canopyCenterY: 0,
            canopyWidth: 0,
            dominantColor: '#000000',
            foliageColor: '#000000',
            hasFoliage: false,
            height: 0,
            stemColor: '#000000',
            stemWidth: 0,
        },
        stems: {
            count: 0,
            matrices: new Float32Array(count),
            radii: new Float32Array(),
            swayPhases: new Float32Array(),
        },
        thorns: {
            count: 0,
            matrices: new Float32Array(),
            swayPhases: new Float32Array(),
        },
        vegetables: [],
        version: PACKED_PLANT_RENDER_DATA_VERSION,
    };
}

test('plant template variants are deterministic and bounded', () => {
    const variants = Array.from({ length: 64 }, (_, index) =>
        resolveGeneratedPlantTemplateVariant(`plant:${index}`),
    );

    assert.deepEqual(
        variants,
        Array.from({ length: 64 }, (_, index) =>
            resolveGeneratedPlantTemplateVariant(`plant:${index}`),
        ),
    );
    assert.ok(
        variants.every(
            (variant) =>
                variant >= 0 && variant < generatedPlantTemplateVariantCount,
        ),
    );
    assert.ok(new Set(variants).size > 1);
});

test('physical instance variation is deterministic and narrowly bounded', () => {
    const variations = Array.from({ length: 64 }, (_, index) =>
        getGeneratedPlantInstanceVariation(`plant:${index}`),
    );

    assert.deepEqual(
        variations,
        Array.from({ length: 64 }, (_, index) =>
            getGeneratedPlantInstanceVariation(`plant:${index}`),
        ),
    );
    assert.ok(
        variations.every(
            ({ leafColorMultiplier, scaleMultiplier, yawRadians }) =>
                scaleMultiplier >= 0.94 &&
                scaleMultiplier <= 1.06 &&
                yawRadians >= 0 &&
                yawRadians < Math.PI * 2 &&
                leafColorMultiplier.every(
                    (multiplier) => multiplier >= 0.96 && multiplier <= 1.04,
                ),
        ),
    );
    assert.ok(new Set(variations.map(({ yawRadians }) => yawRadians)).size > 1);
});

test('plant template keys include every render-affecting input', () => {
    const base = {
        definition: plantTypes.tomato,
        flowerGrowth: 1,
        fruitGrowth: 1,
        generation: 8,
        showFlowers: true,
        showLeaves: true,
        showProduce: true,
        variant: 0,
    };
    const baseKey = getGeneratedPlantTemplateKey(base);

    assert.notEqual(
        getGeneratedPlantTemplateKey({ ...base, generation: 7 }),
        baseKey,
    );
    assert.notEqual(
        getGeneratedPlantTemplateKey({ ...base, flowerGrowth: 0.5 }),
        baseKey,
    );
    assert.notEqual(
        getGeneratedPlantTemplateKey({ ...base, fruitGrowth: 0.5 }),
        baseKey,
    );
    assert.notEqual(
        getGeneratedPlantTemplateKey({ ...base, showProduce: false }),
        baseKey,
    );
    assert.notEqual(
        getGeneratedPlantTemplateKey({ ...base, variant: 1 }),
        baseKey,
    );
});

test('plant template seeds are independent from physical instance seeds', () => {
    assert.equal(
        getGeneratedPlantTemplateSeed({
            definition: plantTypes.tomato,
            generation: 8,
            variant: 2,
        }),
        getGeneratedPlantTemplateSeed({
            definition: plantTypes.tomato,
            generation: 8,
            variant: 2,
        }),
    );
});

test('plant template cache evicts by LRU order and byte weight', () => {
    const value = packedFloatValues(16);
    const cache = new GeneratedPlantTemplateCache({
        maxEntryCount: 2,
        maxEstimatedBytes: 10_000,
    });

    cache.set('a', value).set('b', value);
    assert.equal(cache.get('a'), value);
    cache.set('c', value);

    assert.equal(cache.has('a'), true);
    assert.equal(cache.has('b'), false);
    assert.equal(cache.has('c'), true);
    assert.equal(cache.snapshot().evictionCount, 1);
});

test('plant template cache skips oversized entries without flushing hits', () => {
    const retained = packedFloatValues(4);
    const cache = new GeneratedPlantTemplateCache({
        maxEntryCount: 4,
        maxEstimatedBytes: 500,
    });

    cache.set('retained', retained);
    cache.set('oversized', packedFloatValues(1_000));

    assert.equal(cache.get('retained'), retained);
    assert.equal(cache.has('oversized'), false);
    assert.equal(cache.snapshot().oversizeSkipCount, 1);
    assert.ok(cache.snapshot().estimatedBytes <= 500);
});

test('plant template cache exposes request-scoped counter deltas separately from gauges', () => {
    const cache = new GeneratedPlantTemplateCache({
        maxEntryCount: 4,
        maxEstimatedBytes: 10_000,
    });
    const before = cache.snapshot();
    const value = packedFloatValues(4);

    assert.equal(cache.get('missing'), undefined);
    cache.set('retained', value);
    assert.equal(cache.get('retained'), value);
    const after = cache.snapshot();

    assert.deepEqual(getGeneratedPlantTemplateCacheDelta(before, after), {
        evictionCount: 0,
        hitCount: 1,
        missCount: 1,
        oversizeSkipCount: 0,
        writeCount: 1,
    });
    assert.equal(after.entryCount, 1);
    assert.ok(after.estimatedBytes > 0);
});
